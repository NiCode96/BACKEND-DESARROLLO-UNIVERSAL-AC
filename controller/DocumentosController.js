import { randomInt } from "node:crypto";
import QRCode from "qrcode";
import { PDFDocument } from "pdf-lib";
import DataBase from "../config/Database.js";
import DocumentoEmitido, { aObjetoDocumento } from "../model/DocumentoEmitido.js";
import PacienteOtp from "../model/PacienteOtp.js";
import ProfesionalFirma from "../model/ProfesionalFirma.js";
import RegistroSis from "../model/RegistroSis.js";
import Pacientes from "../model/Pacientes.js";
import Profesionales from "../model/Profesionales.js";
import DatosEmpresa from "../model/DatosEmpresa.js";
import { nuevoId, codigoVerificacion, esDuplicado } from "../services/firma/identificadores.js";
import { ahoraUtc, aMysqlUtc, formatearSantiagoConOffset, isoDesdeMysql } from "../services/firma/tiempo.js";
import { sha256, hmacSha256, huellasIguales, claveHmac } from "../services/firma/huellas.js";
import { registrarEvento } from "../services/firma/cadenaEvidencia.js";
import { registrarAcceso } from "../services/firma/bitacora.js";
import { limitarEstampado } from "../services/firma/limitador.js";
import { estamparFirma } from "../services/firma/estamparFirmaPdf.js";
import { enviarCorreo, htmlDocumentoFirmado } from "../services/firma/correoFirma.js";
import { enviarCodigoOtp, telefonoE164 } from "../services/firma/envioOtp.js";
import { anularPendiente, venceEl } from "../services/firma/vencimientoDocumentos.js";
import { enmascararCorreo, enmascararTelefono, CORREO_VALIDO } from "../services/firma/plantillas.js";
import { esAdministrador, esProfesionalDueno, esRolClinico } from "../services/firma/roles.js";
import { construirKeyPrivada, subirArchivo, eliminarArchivoR2, generarUrlDescarga, descargarArchivoComoBuffer } from "../services/r2Storage.js";

/* Documentos con firma electrónica simple (docs/firma/02 §6).
 *
 * Flujo: el front genera el CUERPO del PDF (sin firma) → prepararDocumento lo
 * guarda en R2 → (consentimiento: el paciente acepta con código OTP) →
 * firmarDocumento: el servidor estampa la grafía, el texto legal y el QR, calcula
 * el SHA-256 y guarda el PDF final UNA vez. Desde ahí se entrega siempre ese
 * mismo archivo (nunca se regenera). Las recetas no pasan por aquí. */

const TIPOS = new Set(["cotizacion", "presupuesto", "orden_examen", "ficha_clinica", "consentimiento_informado", "indicaciones", "certificado_atencion"]);
const REFERENCIAS = new Set(["cotizaciones_pacientes", "fichaClinica", "examenes_clinicos", "presupuesto"]);
const TIPO_LEGIBLE = {
    cotizacion: "Cotización", presupuesto: "Presupuesto", orden_examen: "Orden de exámenes", ficha_clinica: "Ficha clínica",
    consentimiento_informado: "Consentimiento informado", indicaciones: "Indicaciones", certificado_atencion: "Certificado de atención",
};
const MAX_PAGINAS = 40;
const MAX_METADATOS = 64 * 1024;
const PT_A_MM = 25.4 / 72;
const urlVerificacion = (codigo) => `${String(process.env.URL_PUBLICA_SITIO || "").replace(/\/$/, "")}/verificar/${codigo}`;
const respuestaError = (res, error, contexto) => {
    if (error?.codigo === "servicioOcupado") return res.status(503).json({ message: "servicioOcupado" });
    if (error?.codigo === "firmaNoConfigurada") return res.status(503).json({ message: "serverError" });
    console.error(`[DOCUMENTOS] ${contexto}:`, error?.message);
    return res.status(500).json({ message: "serverError" });
};

function leerJson(texto) {
    try { return JSON.parse(texto); } catch { return null; }
}

/** La zona (mm, y desde arriba) es válida y cabe en la página indicada. */
function zonaValida(zona, paginas, tamanos) {
    if (!zona || ![zona.pagina, zona.x, zona.y, zona.ancho, zona.alto].every((n) => typeof n === "number" && Number.isFinite(n))) return false;
    if (!Number.isInteger(zona.pagina) || zona.pagina < 1 || zona.pagina > paginas) return false;
    if (zona.x < 0 || zona.y < 0 || zona.ancho <= 0 || zona.alto <= 0) return false;
    const { ancho, alto } = tamanos[zona.pagina - 1];
    return zona.x + zona.ancho <= ancho + 0.5 && zona.y + zona.alto <= alto + 0.5;
}

async function datosEmpresa() {
    return (await new DatosEmpresa().seleccionarDatosEmpresa())?.[0] || {};
}

/* Acceso a un documento (Ley 20.584, reserva de la ficha clínica): solo el profesional
 * que lo firma y la administración del centro. Otro profesional no ve, descarga, envía
 * ni maneja documentos ajenos, aunque los haya preparado. */
function puedeVer(usuario, documento) {
    return esAdministrador(usuario) || esProfesionalDueno(usuario, documento.id_profesional_firmante);
}

export default class DocumentosController {

    // POST /documentos/prepararDocumento (multipart: pdf + campos)
    static async prepararDocumento(req, res) {
        let borradorKey = null;
        try {
            if (!esRolClinico(req.usuario)) return res.status(403).json({ message: "sinPermiso" });
            const b = req.body || {};
            const tipo = String(b.tipo_documento || "");
            const titulo = String(b.titulo ?? "").trim();
            const idFirmante = Number(b.id_profesional_firmante);
            const idPaciente = b.id_paciente ? Number(b.id_paciente) : null;
            if (!req.file || !titulo || !idFirmante) return res.status(400).json({ message: "sindata" });
            if (!esAdministrador(req.usuario) && !esProfesionalDueno(req.usuario, idFirmante)) return res.status(403).json({ message: "sinPermiso" });
            if (!TIPOS.has(tipo)) return res.status(422).json({ message: "tipoDocumentoNoPermitido" });
            if (titulo.length > 255) return res.status(422).json({ message: "datoinvalido" });
            if (req.file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") return res.status(422).json({ message: "pdfInvalido" });

            const referenciaTabla = b.referencia_tabla ? String(b.referencia_tabla) : null;
            if (referenciaTabla && !REFERENCIAS.has(referenciaTabla)) return res.status(422).json({ message: "datoinvalido" });
            const referenciaId = b.referencia_id ? Number(b.referencia_id) || null : null;

            if (String(b.metadatos || "").length > MAX_METADATOS) return res.status(413).json({ message: "archivoDemasiadoGrande" });
            const metadatos = leerJson(b.metadatos || "{}");
            if (!metadatos || typeof metadatos !== "object") return res.status(422).json({ message: "datoinvalido" });
            metadatos.resumen = String(metadatos.resumen ?? "").slice(0, 90);
            const esConsentimiento = tipo === "consentimiento_informado";
            if (esConsentimiento && !String(metadatos.texto_renderizado ?? "").trim()) return res.status(422).json({ message: "datoinvalido" });

            // El PDF se abre con pdf-lib para contar páginas y medir cada una (operación pesada → limitador).
            const { paginas, tamanos } = await limitarEstampado(async () => {
                const pdf = await PDFDocument.load(req.file.buffer, { updateMetadata: false });
                return {
                    paginas: pdf.getPageCount(),
                    tamanos: pdf.getPages().map((p) => ({ ancho: p.getWidth() * PT_A_MM, alto: p.getHeight() * PT_A_MM })),
                };
            }).catch((error) => { throw error.codigo ? error : Object.assign(error, { pdfInvalido: true }); });
            if (paginas > MAX_PAGINAS) return res.status(413).json({ message: "archivoDemasiadoGrande" });

            const zonaFirma = leerJson(b.zona_firma);
            if (!zonaValida(zonaFirma, paginas, tamanos)) return res.status(422).json({ message: "datoinvalido" });
            // El consentimiento informado exige la zona del paciente (aceptación con código).
            const zonaPaciente = b.zona_paciente ? leerJson(b.zona_paciente) : null;
            if (esConsentimiento && !zonaValida(zonaPaciente, paginas, tamanos)) return res.status(422).json({ message: "datoinvalido" });
            if (!esConsentimiento && zonaPaciente) return res.status(422).json({ message: "tipoDocumentoNoPermitido" });

            if (!(await new RegistroSis().seleccionar(idFirmante))) return res.status(404).json({ message: "noEncontrado" });
            if (idPaciente && !(await new Pacientes().selectPacienteEspecifico(idPaciente))?.[0]) return res.status(404).json({ message: "noEncontrado" });
            if (esConsentimiento && !idPaciente) return res.status(400).json({ message: "sindata" });

            // Quién acepta en el consentimiento: el paciente o su representante legal.
            if (esConsentimiento) {
                metadatos.aceptante = {
                    nombre: String(b.aceptante_nombre ?? "").trim().slice(0, 150) || null,
                    documento: String(b.aceptante_documento ?? "").trim().slice(0, 60) || null,
                };
            }

            borradorKey = construirKeyPrivada("documentos/borradores", "pdf");
            await subirArchivo(req.file.buffer, borradorKey, "application/pdf");
            const ahora = ahoraUtc();
            const fila = {
                id_documento: nuevoId(), tipo_documento: tipo, titulo, referencia_tabla: referenciaTabla, referencia_id: referenciaId,
                id_paciente: idPaciente, id_profesional_firmante: idFirmante, metadatos, zona_firma: zonaFirma, zona_paciente: zonaPaciente,
                borrador_key: borradorKey, borrador_sha256: sha256(req.file.buffer), borrador_bytes: req.file.size, paginas,
                preparado_por_usuario: req.usuario.idUsuario, preparado_por_clerk_id: req.usuario.clerkId,
                preparado_por_nombre: req.usuario.nombre, preparado_at: aMysqlUtc(ahora), preparado_ip: req.contexto?.ip,
            };
            // El código es aleatorio; si choca con uno existente (muy improbable), se reintenta.
            for (let intento = 0; ; intento++) {
                try {
                    fila.codigo_verificacion = codigoVerificacion();
                    await new DocumentoEmitido().insertar(fila);
                    break;
                } catch (error) {
                    if (!esDuplicado(error) || intento >= 2) throw error;
                }
            }
            borradorKey = null; // ya referenciado en la BD

            await registrarAcceso({ id_documento: fila.id_documento, accion: "generado", usuario: req.usuario, contexto: req.contexto });
            const documento = await new DocumentoEmitido().seleccionarPorId(fila.id_documento);
            return res.status(200).json({ message: true, documento: aObjetoDocumento(documento) });
        } catch (error) {
            if (borradorKey) eliminarArchivoR2(borradorKey).catch(() => {});
            if (error?.pdfInvalido) return res.status(422).json({ message: "pdfInvalido" });
            return respuestaError(res, error, "prepararDocumento");
        }
    }

    // POST /documentos/seleccionarBorrador → URL firmada del cuerpo sin firmar
    static async seleccionarBorrador(req, res) {
        try {
            const documento = await new DocumentoEmitido().seleccionarPorId(req.body?.id_documento);
            if (!documento) return res.status(404).json({ message: "noEncontrado" });
            if (!puedeVer(req.usuario, documento)) return res.status(403).json({ message: "sinPermiso" });

            await registrarAcceso({ id_documento: documento.id_documento, accion: "visto", usuario: req.usuario, contexto: req.contexto });
            const nombre = `${documento.tipo_documento}-${documento.codigo_verificacion}-borrador.pdf`;
            const url = await generarUrlDescarga(documento.borrador_key, 60, { nombre, tipo: "application/pdf" });
            res.set("Cache-Control", "no-store");
            return res.status(200).json({ message: true, url, sha256: documento.borrador_sha256, nombre, expira_at: new Date(Date.now() + 60_000).toISOString() });
        } catch (error) {
            return respuestaError(res, error, "seleccionarBorrador");
        }
    }

    // POST /documentos/firmarDocumento (reverificación obligatoria)
    // Tres fases: la transacción nunca queda abierta mientras se usa R2 o se estampa (docs/firma/03 §7.3).
    static async firmarDocumento(req, res) {
        let pdfKey = null;
        try {
            // ── Fase A: validar (lecturas simples) ────────────────────────────
            const modelo = new DocumentoEmitido();
            const documento = await modelo.seleccionarPorId(req.body?.id_documento);
            if (!documento) return res.status(404).json({ message: "noEncontrado" });
            if (documento.estado === "firmado") return res.status(409).json({ message: "documentoYaFirmado" });
            if (documento.estado === "anulado") return res.status(409).json({ message: "documentoAnulado" });
            if (!esProfesionalDueno(req.usuario, documento.id_profesional_firmante)) return res.status(403).json({ message: "sinPermiso" });
            if (documento.zona_paciente && !documento.paciente_acepto_at) return res.status(409).json({ message: "otpRequerido" });
            const firma = await new ProfesionalFirma().seleccionarActiva(documento.id_profesional_firmante);
            if (!firma) return res.status(409).json({ message: "firmaInexistente" });
            const profesional = (await new Profesionales().seleccionarProfesionalPorID(documento.id_profesional_firmante))?.[0];
            const paciente = documento.id_paciente ? (await new Pacientes().selectPacienteEspecifico(documento.id_paciente))?.[0] : null;
            claveHmac(); // sin clave de evidencia no se firma (falla antes de estampar)

            // ── Fase B: trabajo pesado, sin conexión a MySQL ──────────────────
            const firmadoAt = ahoraUtc();
            const resultado = await limitarEstampado(async () => {
                const [borrador, grafia] = await Promise.all([
                    descargarArchivoComoBuffer(documento.borrador_key),
                    descargarArchivoComoBuffer(firma.imagen_key),
                ]);
                if (sha256(borrador) !== documento.borrador_sha256 || sha256(grafia) !== firma.imagen_sha256) {
                    throw Object.assign(new Error("integridad: el borrador o la grafía guardados no coinciden con su huella"), { integridad: true });
                }
                const aceptante = documento.metadatos?.aceptante || {};
                const bytes = await estamparFirma({
                    borrador,
                    zona: documento.zona_firma,
                    grafiaPng: grafia,
                    qrPng: await QRCode.toBuffer(urlVerificacion(documento.codigo_verificacion), { errorCorrectionLevel: "M", margin: 1, width: 360 }),
                    firmante: {
                        nombre: profesional?.nombreProfesional,
                        rut: profesional?.rutProfesional,
                        profesion: profesional?.descripcionProfesional,
                        registroSis: profesional?.registro_sis_estado !== "rechazado" ? profesional?.registro_sis_numero : null,
                    },
                    textoFecha: formatearSantiagoConOffset(firmadoAt),
                    firmadoAt,
                    codigo: documento.codigo_verificacion,
                    resumen: documento.metadatos?.resumen,
                    titulo: documento.titulo,
                    zonaPaciente: documento.zona_paciente,
                    aceptacionPaciente: documento.zona_paciente
                        ? {
                            nombre: aceptante.nombre || `${paciente?.nombre ?? ""} ${paciente?.apellido ?? ""}`.trim(),
                            documento: aceptante.documento || (paciente?.rut ? `RUT ${paciente.rut}` : ""),
                            canal: documento.paciente_canal,
                            destino: documento.paciente_destino,
                            textoFecha: formatearSantiagoConOffset(new Date(documento.paciente_acepto_at)),
                        }
                        : undefined,
                });
                const buffer = Buffer.from(bytes);
                pdfKey = construirKeyPrivada("documentos/firmados", "pdf");
                await subirArchivo(buffer, pdfKey, "application/pdf");
                return { sha: sha256(buffer), bytes: buffer.length };
            });

            // ── Fase C: confirmar (transacción corta) ─────────────────────────
            const conexion = await DataBase.getInstance().obtenerConexion();
            try {
                await conexion.beginTransaction();
                const actual = await modelo.seleccionarPorId(documento.id_documento, conexion);
                if (actual.estado !== "pendiente_firma") {
                    await conexion.rollback();
                    eliminarArchivoR2(pdfKey).catch(() => {});
                    pdfKey = null;
                    return res.status(409).json({ message: actual.estado === "anulado" ? "documentoAnulado" : "documentoYaFirmado" });
                }
                await modelo.marcarFirmado(conexion, documento.id_documento, {
                    id_firma: firma.id_firma, firmado_por_usuario: req.usuario.idUsuario, firmado_por_clerk_id: req.usuario.clerkId,
                    firmado_at: aMysqlUtc(firmadoAt), pdf_key: pdfKey, pdf_sha256: resultado.sha, pdf_bytes: resultado.bytes,
                });
                await registrarEvento(conexion, {
                    tipo_evento: "documento_firmado", id_documento: documento.id_documento, id_firma: firma.id_firma,
                    id_profesional: documento.id_profesional_firmante, id_paciente: documento.id_paciente,
                    actor_tipo: "profesional", actor_usuario: req.usuario.idUsuario, actor_clerk_id: req.usuario.clerkId,
                    actor_nombre: req.usuario.nombre, metodo_autenticacion: req.reverificacion.metodo,
                    autenticado_at: req.reverificacion.autenticadoAt, documento_sha256: resultado.sha,
                    ip: req.contexto?.ip, user_agent: req.contexto?.userAgent,
                    datos: {
                        codigo: documento.codigo_verificacion, tipo_documento: documento.tipo_documento,
                        borrador_sha256: documento.borrador_sha256, imagen_sha256: firma.imagen_sha256,
                        id_otp: documento.paciente_otp_id || null, plantillas: documento.metadatos?.plantillas || [],
                        preparado_por_clerk_id: documento.preparado_por_clerk_id, preparado_at: documento.preparado_at,
                    },
                });
                await conexion.commit();
                pdfKey = null;
            } catch (error) {
                await conexion.rollback().catch(() => {});
                throw error;
            } finally {
                conexion.release();
            }

            return res.status(200).json({ message: true, documento: aObjetoDocumento(await modelo.seleccionarPorId(documento.id_documento)) });
        } catch (error) {
            if (pdfKey) eliminarArchivoR2(pdfKey).catch(() => {});
            if (error?.integridad) {
                console.error("[DOCUMENTOS] firmarDocumento:", error.message);
                return res.status(500).json({ message: "serverError" });
            }
            return respuestaError(res, error, "firmarDocumento");
        }
    }

    // POST /documentos/descargarDocumento → URL firmada del PDF firmado (no pasa por el backend)
    static async descargarDocumento(req, res) {
        try {
            const { id_documento, accion = "visto" } = req.body || {};
            if (!["visto", "descargado", "impreso"].includes(accion)) return res.status(400).json({ message: "sindata" });
            const documento = await new DocumentoEmitido().seleccionarPorId(id_documento);
            if (!documento || !documento.pdf_key) return res.status(404).json({ message: "noEncontrado" });
            if (!puedeVer(req.usuario, documento)) return res.status(403).json({ message: "sinPermiso" });

            // Primero la bitácora: si no se puede registrar el acceso, no se entrega el archivo.
            await registrarAcceso({ id_documento: documento.id_documento, accion, usuario: req.usuario, contexto: req.contexto });
            const nombre = `${documento.tipo_documento}-${documento.codigo_verificacion}.pdf`;
            const url = await generarUrlDescarga(documento.pdf_key, 60, { nombre, tipo: "application/pdf" });
            res.set("Cache-Control", "no-store");
            return res.status(200).json({ message: true, url, sha256: documento.pdf_sha256, nombre, expira_at: new Date(Date.now() + 60_000).toISOString() });
        } catch (error) {
            return respuestaError(res, error, "descargarDocumento");
        }
    }

    // POST /documentos/enviarDocumentoCorreo { id_documento, correo? }
    static async enviarDocumentoCorreo(req, res) {
        try {
            const documento = await new DocumentoEmitido().seleccionarPorId(req.body?.id_documento);
            if (!documento || documento.estado !== "firmado") return res.status(404).json({ message: "noEncontrado" });
            if (!puedeVer(req.usuario, documento)) return res.status(403).json({ message: "sinPermiso" });

            const paciente = documento.id_paciente ? (await new Pacientes().selectPacienteEspecifico(documento.id_paciente))?.[0] : null;
            const destino = String(req.body?.correo || paciente?.correo || "").trim();
            if (!CORREO_VALIDO.test(destino)) return res.status(422).json({ message: "correoInvalido" });

            // Se adjuntan los bytes GUARDADOS, verificados contra su huella.
            const pdf = await limitarEstampado(() => descargarArchivoComoBuffer(documento.pdf_key));
            if (sha256(pdf) !== documento.pdf_sha256) {
                console.error("[DOCUMENTOS] el PDF guardado no coincide con su huella:", documento.codigo_verificacion);
                return res.status(500).json({ message: "serverError" });
            }
            const empresa = await datosEmpresa();
            const tipoLegible = TIPO_LEGIBLE[documento.tipo_documento] || "Documento";
            const enviado = await enviarCorreo({
                empresa, para: destino, nombre: paciente ? `${paciente.nombre ?? ""} ${paciente.apellido ?? ""}`.trim() : undefined,
                asunto: `Tienes un documento de ${empresa.empresaNombre || "tu centro de salud"}`,
                html: htmlDocumentoFirmado({
                    empresa, nombrePaciente: paciente?.nombre, tipoLegible, profesional: documento.firmante_nombre,
                    codigo: documento.codigo_verificacion, urlVerificacion: urlVerificacion(documento.codigo_verificacion),
                }),
                adjuntos: [{ nombre: `${documento.tipo_documento}-${documento.codigo_verificacion}.pdf`, contenido: pdf }],
            });
            if (!enviado) return res.status(503).json({ message: "servicioOcupado" });
            await registrarAcceso({ id_documento: documento.id_documento, accion: "enviado", usuario: req.usuario, contexto: req.contexto, destinatario: destino });
            return res.status(200).json({ message: true, enviadoA: enmascararCorreo(destino) });
        } catch (error) {
            return respuestaError(res, error, "enviarDocumentoCorreo");
        }
    }

    // POST /documentos/listarDocumentosPaciente { id_paciente }
    static async listarDocumentosPaciente(req, res) {
        try {
            if (!esRolClinico(req.usuario)) return res.status(403).json({ message: "sinPermiso" });
            const id_paciente = Number(req.body?.id_paciente);
            if (!id_paciente) return res.status(400).json({ message: "sindata" });
            const filas = await new DocumentoEmitido().listarPorPaciente(id_paciente);
            // La administración ve todos; un profesional, solo los que firma él.
            const visibles = esAdministrador(req.usuario) ? filas : filas.filter((f) => esProfesionalDueno(req.usuario, f.id_profesional_firmante));
            return res.status(200).json({ message: true, documentos: visibles.map(aObjetoDocumento) });
        } catch (error) {
            return respuestaError(res, error, "listarDocumentosPaciente");
        }
    }

    // POST /documentos/listarPendientesFirma
    //   documentos: los que esperan la firma del usuario (solo él puede firmarlos)
    //   enviados:   (administración) los que preparó y esperan la firma de otro profesional
    //   clinica:    (administración) el resto de lo pendiente del centro
    static async listarPendientesFirma(req, res) {
        try {
            const modelo = new DocumentoEmitido();
            const { idProfesional, clerkId } = req.usuario;
            const [propios, enviados, clinica] = await Promise.all([
                idProfesional ? modelo.listarPendientesPorFirmante(idProfesional) : [],
                // Lo preparado para otro profesional solo lo sigue la administración.
                esAdministrador(req.usuario) ? modelo.listarEnviadosPendientes(clerkId, idProfesional) : [],
                esAdministrador(req.usuario) ? modelo.listarPendientesClinica(clerkId, idProfesional) : [],
            ]);
            // vence_at: cuándo se anula solo si nadie lo firma (services/firma/vencimientoDocumentos.js).
            // Un consentimiento que espera el código del paciente se puede terminar desde la
            // bandeja: va el contacto de la ficha ENMASCARADO (para elegir canal); el código
            // siempre se envía al dato registrado, nunca a uno que mande el navegador.
            const conVencimiento = (fila) => {
                const documento = aObjetoDocumento(fila);
                const esperaCodigo = documento.requiere_aceptacion_paciente && !documento.paciente_acepto_at;
                return {
                    ...documento,
                    vence_at: venceEl(documento),
                    ...(esperaCodigo ? { contacto_paciente: {
                        telefono: telefonoE164(fila.paciente_telefono_ficha) ? enmascararTelefono(fila.paciente_telefono_ficha) : null,
                        correo: CORREO_VALIDO.test(String(fila.paciente_correo_ficha ?? "")) ? enmascararCorreo(fila.paciente_correo_ficha) : null,
                    } } : {}),
                };
            };
            return res.status(200).json({
                message: true,
                documentos: propios.map(conVencimiento),
                enviados: enviados.map(conVencimiento),
                clinica: clinica.map(conVencimiento),
            });
        } catch (error) {
            return respuestaError(res, error, "listarPendientesFirma");
        }
    }

    // POST /documentos/quitarPendiente { id_documento, motivo? }
    // Saca de la bandeja un documento que NO se ha firmado: el profesional firmante o la
    // administración. Sin reverificación (nada firmado que proteger); queda el evento
    // documento_anulado y se borra el borrador de R2. Un documento firmado se anula con
    // anularDocumento, que sí pide reverificación.
    static async quitarPendiente(req, res) {
        try {
            const documento = await new DocumentoEmitido().seleccionarPorId(req.body?.id_documento);
            if (!documento) return res.status(404).json({ message: "noEncontrado" });
            if (!puedeVer(req.usuario, documento)) return res.status(403).json({ message: "sinPermiso" });
            if (documento.estado !== "pendiente_firma") return res.status(409).json({ message: documento.estado === "firmado" ? "documentoYaFirmado" : "documentoAnulado" });
            const motivo = String(req.body?.motivo ?? "").trim().slice(0, 500) || "Quitado de la bandeja sin firmar";
            const actor = { ...req.usuario, esFirmante: esProfesionalDueno(req.usuario, documento.id_profesional_firmante) };
            const quitado = await anularPendiente({ id_documento: documento.id_documento, motivo, actor, contexto: req.contexto });
            if (!quitado) return res.status(409).json({ message: "documentoYaFirmado" });
            return res.status(200).json({ message: true });
        } catch (error) {
            return respuestaError(res, error, "quitarPendiente");
        }
    }

    // POST /documentos/anularDocumento { id_documento, motivo } (reverificación obligatoria)
    static async anularDocumento(req, res) {
        const conexion = await DataBase.getInstance().obtenerConexion();
        try {
            const motivo = String(req.body?.motivo ?? "").trim().slice(0, 500);
            if (!req.body?.id_documento || !motivo) return res.status(400).json({ message: "sindata" });
            await conexion.beginTransaction();
            const modelo = new DocumentoEmitido();
            const documento = await modelo.seleccionarPorId(req.body.id_documento, conexion);
            if (!documento) { await conexion.rollback(); return res.status(404).json({ message: "noEncontrado" }); }
            const dueno = esProfesionalDueno(req.usuario, documento.id_profesional_firmante);
            if (!dueno && !esAdministrador(req.usuario)) { await conexion.rollback(); return res.status(403).json({ message: "sinPermiso" }); }
            if (documento.estado === "anulado") { await conexion.rollback(); return res.status(409).json({ message: "documentoAnulado" }); }

            const ahora = ahoraUtc();
            await modelo.anular(conexion, documento.id_documento, req.usuario.idUsuario, motivo, aMysqlUtc(ahora));
            await registrarEvento(conexion, {
                tipo_evento: "documento_anulado", id_documento: documento.id_documento, id_profesional: documento.id_profesional_firmante,
                id_paciente: documento.id_paciente, actor_tipo: dueno ? "profesional" : "operador",
                actor_usuario: req.usuario.idUsuario, actor_clerk_id: req.usuario.clerkId, actor_nombre: req.usuario.nombre,
                metodo_autenticacion: req.reverificacion.metodo, autenticado_at: req.reverificacion.autenticadoAt,
                documento_sha256: documento.pdf_sha256, ip: req.contexto?.ip, user_agent: req.contexto?.userAgent,
                datos: { motivo, estado_anterior: documento.estado, codigo: documento.codigo_verificacion },
            });
            await conexion.commit();
            return res.status(200).json({ message: true });
        } catch (error) {
            await conexion.rollback().catch(() => {});
            return respuestaError(res, error, "anularDocumento");
        } finally {
            conexion.release();
        }
    }

    // POST /documentos/solicitarOtpPaciente { id_documento, canal: "whatsapp" | "sms" | "email" }
    // El código va al dato YA REGISTRADO en la ficha del paciente: nunca a uno que mande el cliente.
    static async solicitarOtpPaciente(req, res) {
        try {
            if (!esRolClinico(req.usuario)) return res.status(403).json({ message: "sinPermiso" });
            const { id_documento } = req.body || {};
            const canal = ["whatsapp", "sms", "email"].includes(req.body?.canal) ? req.body.canal : null;
            if (!id_documento || !canal) return res.status(400).json({ message: "sindata" });
            const porTelefono = canal !== "email";

            const documento = await new DocumentoEmitido().seleccionarPorId(id_documento);
            if (!documento) return res.status(404).json({ message: "noEncontrado" });
            if (!puedeVer(req.usuario, documento)) return res.status(403).json({ message: "sinPermiso" });
            if (documento.estado !== "pendiente_firma") return res.status(409).json({ message: "documentoYaFirmado" });
            if (!documento.zona_paciente || !documento.id_paciente) return res.status(422).json({ message: "tipoDocumentoNoPermitido" });

            const ahora = ahoraUtc();
            const recientes = await new PacienteOtp().contarRecientes(id_documento, aMysqlUtc(new Date(ahora.getTime() - 10 * 60_000)));
            if (recientes >= 5) return res.status(429).json({ message: "demasiadasSolicitudes" });

            const paciente = (await new Pacientes().selectPacienteEspecifico(documento.id_paciente))?.[0];
            const dato = porTelefono ? paciente?.telefono : paciente?.correo;
            if (!dato || (canal === "email" && !CORREO_VALIDO.test(String(dato)))) return res.status(422).json({ message: "sinDatoContacto" });
            if (porTelefono && !telefonoE164(dato)) return res.status(422).json({ message: "sinDatoContacto" });
            const destino = porTelefono ? enmascararTelefono(dato) : enmascararCorreo(dato);

            const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
            const id_otp = nuevoId();
            const expira = new Date(ahora.getTime() + 10 * 60_000);
            const conexion = await DataBase.getInstance().obtenerConexion();
            try {
                await conexion.beginTransaction();
                const modelo = new PacienteOtp();
                await modelo.invalidarPendientes(conexion, id_documento, aMysqlUtc(ahora));
                await modelo.insertar(conexion, {
                    id_otp, id_documento, id_paciente: documento.id_paciente, canal, destino_mascarado: destino,
                    codigo_hash: hmacSha256(claveHmac().clave, codigo + id_otp), creado_at: aMysqlUtc(ahora), expira_at: aMysqlUtc(expira),
                });
                await conexion.commit();
            } catch (error) {
                await conexion.rollback().catch(() => {});
                throw error;
            } finally {
                conexion.release();
            }

            const enviado = await enviarCodigoOtp({ canal, destino: dato, codigo, empresa: await datosEmpresa() }).catch((error) => {
                console.error("[DOCUMENTOS] envío OTP:", error.message);
                return false;
            });
            if (!enviado) return res.status(503).json({ message: "servicioOcupado" });
            return res.status(200).json({ message: true, destino, expira_at: expira.toISOString() });
        } catch (error) {
            return respuestaError(res, error, "solicitarOtpPaciente");
        }
    }

    // POST /documentos/verificarOtpPaciente { id_documento, codigo }
    static async verificarOtpPaciente(req, res) {
        const conexion = await DataBase.getInstance().obtenerConexion();
        try {
            if (!esRolClinico(req.usuario)) return res.status(403).json({ message: "sinPermiso" });
            const { id_documento } = req.body || {};
            const codigo = String(req.body?.codigo ?? "").trim();
            if (!id_documento || !/^\d{6}$/.test(codigo)) return res.status(400).json({ message: "sindata" });

            await conexion.beginTransaction();
            const documento = await new DocumentoEmitido().seleccionarPorId(id_documento, conexion);
            if (documento && !puedeVer(req.usuario, documento)) { await conexion.rollback(); return res.status(403).json({ message: "sinPermiso" }); }
            if (!documento || documento.estado !== "pendiente_firma") { await conexion.rollback(); return res.status(409).json({ message: "otpExpirado" }); }
            const modelo = new PacienteOtp();
            const otp = await modelo.ultimo(conexion, id_documento);
            const ahora = ahoraUtc();
            if (!otp || otp.verificado_at || new Date(isoDesdeMysql(otp.expira_at)) <= ahora) { await conexion.rollback(); return res.status(409).json({ message: "otpExpirado" }); }
            if (otp.intentos >= 5) { await conexion.rollback(); return res.status(429).json({ message: "otpIntentosAgotados" }); }

            if (!huellasIguales(hmacSha256(claveHmac().clave, codigo + otp.id_otp), otp.codigo_hash)) {
                await modelo.sumarIntento(conexion, otp.id_otp);
                await conexion.commit();
                return otp.intentos + 1 >= 5
                    ? res.status(429).json({ message: "otpIntentosAgotados" })
                    : res.status(422).json({ message: "otpInvalido" });
            }

            const paciente = (await new Pacientes().selectPacienteEspecifico(documento.id_paciente))?.[0];
            const aceptante = documento.metadatos?.aceptante || {};
            const firmante = [aceptante.nombre || `${paciente?.nombre ?? ""} ${paciente?.apellido ?? ""}`.trim(), aceptante.documento]
                .filter(Boolean).join(" · ").slice(0, 255);
            await modelo.marcarVerificado(conexion, otp.id_otp, aMysqlUtc(ahora), req.contexto?.ip);
            await new DocumentoEmitido().registrarAceptacionPaciente(conexion, id_documento, {
                id_otp: otp.id_otp, acepto_at: aMysqlUtc(ahora), canal: otp.canal, destino: otp.destino_mascarado, firmante,
            });
            await registrarEvento(conexion, {
                tipo_evento: "otp_paciente_verificado", id_documento, id_paciente: documento.id_paciente,
                actor_tipo: "paciente", actor_nombre: firmante, metodo_autenticacion: `otp_${otp.canal}`, // otp_whatsapp | otp_sms | otp_email
                autenticado_at: ahora, ip: req.contexto?.ip, user_agent: req.contexto?.userAgent,
                datos: { canal: otp.canal, destino: otp.destino_mascarado, id_otp: otp.id_otp, operador_clerk_id: req.usuario.clerkId },
            });
            await conexion.commit();
            return res.status(200).json({ message: true, aceptacion: { canal: otp.canal, destino: otp.destino_mascarado, verificado_at: ahora.toISOString() } });
        } catch (error) {
            await conexion.rollback().catch(() => {});
            return respuestaError(res, error, "verificarOtpPaciente");
        } finally {
            conexion.release();
        }
    }
}
