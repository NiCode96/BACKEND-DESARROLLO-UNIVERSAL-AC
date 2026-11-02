import DataBase from "../config/Database.js";
import DocumentoPlantilla from "../model/DocumentoPlantilla.js";
import ConsentimientoAceptacion from "../model/ConsentimientoAceptacion.js";
import DatosEmpresa from "../model/DatosEmpresa.js";
import Profesionales from "../model/Profesionales.js";
import Pacientes from "../model/Pacientes.js";
import { nuevoId, codigoVerificacion, tokenAceptacion, esDuplicado } from "../services/firma/identificadores.js";
import { ahoraUtc, aMysqlUtc, formatearSantiagoConOffset } from "../services/firma/tiempo.js";
import { sha256 } from "../services/firma/huellas.js";
import { documentoNormalizado, limpiarRut } from "../services/firma/rut.js";
import { interpolarPlantilla, enmascararCorreo, CORREO_VALIDO } from "../services/firma/plantillas.js";
import { registrarEvento } from "../services/firma/cadenaEvidencia.js";
import { registrarAcceso } from "../services/firma/bitacora.js";
import { generarConstancia } from "../services/firma/constanciaConsentimiento.js";
import { enviarCorreo, htmlConstancias } from "../services/firma/correoFirma.js";
import { esAdministrador, esRolClinico } from "../services/firma/roles.js";
import { construirKeyPrivada, subirArchivo, eliminarArchivoR2, generarUrlDescarga, descargarArchivoComoBuffer } from "../services/r2Storage.js";

/* Consentimientos de la reserva pública (Ley 21.719 y Ley 20.584).
 * Contrato: docs/firma/02-contrato-endpoints.md §7.
 *
 * La política de privacidad es la ÚNICA aceptación obligatoria (casilla). Los
 * "Derechos y deberes del paciente" (Ley 20.584) se muestran como lectura, sin
 * casilla: la ley exige informarlos, no aceptarlos. El servidor fija la hora, la
 * IP y el texto exacto (interpolado) que vio el paciente, genera UNA vez la
 * constancia en PDF, la guarda en R2 con su huella y la registra en la cadena de
 * evidencia. Si mañana se agrega otro texto obligatorio, basta sumarlo aquí y en
 * CODIGOS_OBLIGATORIOS de src/lib/consentimientos/textosLegales.js. */

const CODIGOS_OBLIGATORIOS = ["tratamiento_datos"];
const urlVerificacion = (codigo) => `${String(process.env.URL_PUBLICA_SITIO || "").replace(/\/$/, "")}/verificar/${codigo}`;

async function datosEmpresa() {
    const filas = await new DatosEmpresa().seleccionarDatosEmpresa();
    return (Array.isArray(filas) ? filas[0] : filas) || {};
}

/**
 * Vincula las aceptaciones de un token con la reserva recién creada.
 * La usan ReservaPacienteController y MercadoPagoController. NUNCA lanza: si el
 * token no existe o ya se usó, se registra y la reserva sigue (no se pierde una
 * reserva por esto).
 */
export async function vincularAceptacionConReserva(token, id_reserva, documento) {
    if (!token || !/^ca_[0-9a-f]{32}$/.test(String(token))) return;
    try {
        const resultado = await new ConsentimientoAceptacion().vincularReserva(
            String(token), id_reserva ?? null, limpiarRut(documento), aMysqlUtc(ahoraUtc())
        );
        if (!resultado?.affectedRows) console.error("[CONSENTIMIENTOS] token sin aceptaciones pendientes:", String(token).slice(0, 8));
    } catch (error) {
        console.error("[CONSENTIMIENTOS] no se pudo vincular la reserva:", error.message);
    }
}

export default class ConsentimientosController {

    // GET /consentimientos/seleccionarVigentes (público)
    static async seleccionarVigentes(req, res) {
        try {
            const plantillas = await new DocumentoPlantilla().seleccionarVigentesPorCategoria("consentimiento_publico");
            res.set("Cache-Control", "no-store");
            return res.status(200).json({ message: true, plantillas });
        } catch (error) {
            console.error("[CONSENTIMIENTOS] seleccionarVigentes:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }

    // POST /consentimientos/registrarAceptacion (público, con límite de tasa)
    static async registrarAceptacion(req, res) {
        const subidos = [];
        try {
            const { aceptaciones, paciente, id_profesional } = req.body || {};
            if (!Array.isArray(aceptaciones) || !paciente) return res.status(400).json({ message: "sindata" });

            const nombre = String(paciente.nombre ?? "").trim().slice(0, 255);
            const apellido = String(paciente.apellido ?? "").trim().slice(0, 255);
            const tipoDocumento = paciente.tipo_documento === "pasaporte" ? "pasaporte" : "rut";
            const documento = documentoNormalizado(tipoDocumento, paciente.documento);
            const correo = String(paciente.correo ?? "").trim().slice(0, 255);
            const telefono = String(paciente.telefono ?? "").trim().slice(0, 30) || null;
            if (!nombre || !apellido) return res.status(400).json({ message: "sindata" });
            if (!documento) return res.status(422).json({ message: tipoDocumento === "rut" ? "rutInvalido" : "documentoInvalido" });
            if (!CORREO_VALIDO.test(correo)) return res.status(422).json({ message: "correoInvalido" });

            // Las dos aceptaciones deben corresponder EXACTAMENTE a las versiones vigentes.
            const vigentes = await new DocumentoPlantilla().seleccionarVigentesPorCategoria("consentimiento_publico");
            const porCodigo = new Map(vigentes.map((p) => [p.codigo, p]));
            for (const codigo of CODIGOS_OBLIGATORIOS) {
                const aceptada = aceptaciones.find((a) => a?.codigo === codigo);
                const vigente = porCodigo.get(codigo);
                if (!aceptada || !vigente) return res.status(400).json({ message: "sindata" });
                if (aceptada.id_plantilla !== vigente.id_plantilla || Number(aceptada.version) !== Number(vigente.version) || aceptada.sha256 !== vigente.sha256) {
                    return res.status(409).json({ message: "actaDesactualizada" });
                }
            }

            const empresa = await datosEmpresa();
            const idProfesional = Number(id_profesional) || null;
            const profesional = idProfesional ? (await new Profesionales().seleccionarProfesionalPorID(idProfesional))?.[0] : null;
            const aceptadoAt = ahoraUtc();
            const textoFecha = formatearSantiagoConOffset(aceptadoAt);
            const token = tokenAceptacion();

            // 1) Trabajo pesado FUERA de la transacción: textos, constancias y subida a R2.
            const filas = [];
            for (const codigo of CODIGOS_OBLIGATORIOS) {
                const plantilla = porCodigo.get(codigo);
                const texto = interpolarPlantilla(plantilla.cuerpo, { empresa, profesional: profesional || {} });
                const textoSha256 = sha256(texto);
                const codigoVer = codigoVerificacion();
                const pdf = await generarConstancia({
                    empresa, titulo: plantilla.titulo, codigoPlantilla: codigo, version: plantilla.version,
                    textoSha256, texto, paciente: { nombre, apellido, tipo_documento: tipoDocumento, documento },
                    textoFecha, codigo: codigoVer, urlVerificacion: urlVerificacion(codigoVer),
                });
                const pdfKey = construirKeyPrivada("consentimientos", "pdf");
                await subirArchivo(pdf, pdfKey, "application/pdf");
                subidos.push(pdfKey);
                filas.push({
                    id_aceptacion: nuevoId(), token_aceptacion: token, codigo_verificacion: codigoVer,
                    id_plantilla: plantilla.id_plantilla, plantilla_codigo: codigo, plantilla_version: plantilla.version,
                    plantilla_sha256: plantilla.sha256, texto_renderizado: texto, texto_sha256: textoSha256,
                    id_profesional: profesional ? idProfesional : null, paciente_nombre: nombre, paciente_apellido: apellido,
                    paciente_tipo_documento: tipoDocumento, paciente_documento: documento, paciente_correo: correo,
                    paciente_telefono: telefono, aceptado_at: aMysqlUtc(aceptadoAt), ip: req.ip || null,
                    user_agent: (req.get("user-agent") || "").slice(0, 255), pdf_key: pdfKey, pdf_sha256: sha256(pdf),
                    _pdf: pdf, _titulo: plantilla.titulo,
                });
            }

            // 2) Transacción corta: filas + eventos de evidencia.
            const conexion = await DataBase.getInstance().obtenerConexion();
            try {
                await conexion.beginTransaction();
                const modelo = new ConsentimientoAceptacion();
                for (const fila of filas) {
                    await modelo.insertar(conexion, fila);
                    await registrarEvento(conexion, {
                        tipo_evento: "consentimiento_aceptado",
                        id_aceptacion: fila.id_aceptacion,
                        id_profesional: fila.id_profesional,
                        actor_tipo: "paciente",
                        actor_nombre: `${nombre} ${apellido}`,
                        metodo_autenticacion: "formulario_publico",
                        autenticado_at: aceptadoAt,
                        documento_sha256: fila.pdf_sha256,
                        ip: fila.ip,
                        user_agent: fila.user_agent,
                        datos: {
                            codigo: fila.codigo_verificacion, plantilla: fila.plantilla_codigo,
                            version: fila.plantilla_version, plantilla_sha256: fila.plantilla_sha256,
                            texto_sha256: fila.texto_sha256, tipo_documento: tipoDocumento,
                        },
                    });
                }
                await conexion.commit();
            } catch (error) {
                await conexion.rollback().catch(() => {});
                throw error;
            } finally {
                conexion.release();
            }
            subidos.length = 0; // ya quedaron referenciados en la BD: no se borran

            // 3) Constancia por correo, sin bloquear la respuesta.
            enviarCorreo({
                empresa, para: correo, nombre: `${nombre} ${apellido}`,
                asunto: `Constancia de tu aceptación - ${empresa.empresaNombre || "Centro de salud"}`,
                html: htmlConstancias({ empresa, nombrePaciente: nombre }),
                adjuntos: filas.map((f) => ({ nombre: `${f.plantilla_codigo}-${f.codigo_verificacion}.pdf`, contenido: f._pdf })),
            }).catch((error) => console.error("[CONSENTIMIENTOS] correo de constancia:", error.message));

            return res.status(200).json({ message: true, token_aceptacion: token, codigo_verificacion: filas[0].codigo_verificacion });
        } catch (error) {
            for (const key of subidos) eliminarArchivoR2(key).catch(() => {});
            if (esDuplicado(error)) return res.status(409).json({ message: "conflicto" });
            console.error("[CONSENTIMIENTOS] registrarAceptacion:", error.message);
            return res.status(error.codigo === "firmaNoConfigurada" ? 503 : 500).json({ message: "serverError" });
        }
    }

    // POST /consentimientos/listarPorPaciente (auth)
    static async listarPorPaciente(req, res) {
        try {
            if (!esRolClinico(req.usuario)) return res.status(403).json({ message: "sinPermiso" });
            const id_paciente = Number(req.body?.id_paciente);
            if (!id_paciente) return res.status(400).json({ message: "sindata" });
            const paciente = (await new Pacientes().selectPacienteEspecifico(id_paciente))?.[0];
            const aceptaciones = await new ConsentimientoAceptacion().listarPorPaciente(id_paciente, limpiarRut(paciente?.rut));
            return res.status(200).json({ message: true, aceptaciones });
        } catch (error) {
            console.error("[CONSENTIMIENTOS] listarPorPaciente:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }

    // POST /consentimientos/descargarAceptacion (auth) → URL firmada de 60 s
    static async descargarAceptacion(req, res) {
        try {
            if (!esRolClinico(req.usuario)) return res.status(403).json({ message: "sinPermiso" });
            const { id_aceptacion, accion = "visto" } = req.body || {};
            if (!id_aceptacion || !["visto", "descargado", "impreso"].includes(accion)) return res.status(400).json({ message: "sindata" });
            const aceptacion = await new ConsentimientoAceptacion().seleccionarPorId(id_aceptacion);
            if (!aceptacion) return res.status(404).json({ message: "noEncontrado" });

            // Primero la bitácora: sin registro del acceso no se entrega el archivo.
            await registrarAcceso({ id_aceptacion, accion, usuario: req.usuario, contexto: req.contexto });
            const nombre = `${aceptacion.codigo}-${aceptacion.codigo_verificacion}.pdf`;
            const url = await generarUrlDescarga(aceptacion.pdf_key, 60, { nombre, tipo: "application/pdf" });
            res.set("Cache-Control", "no-store");
            return res.status(200).json({
                message: true, url, sha256: aceptacion.pdf_sha256, nombre,
                expira_at: new Date(Date.now() + 60_000).toISOString(),
            });
        } catch (error) {
            console.error("[CONSENTIMIENTOS] descargarAceptacion:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }

    // POST /consentimientos/enviarAceptacionCorreo (auth)
    static async enviarAceptacionCorreo(req, res) {
        try {
            if (!esRolClinico(req.usuario)) return res.status(403).json({ message: "sinPermiso" });
            const { id_aceptacion } = req.body || {};
            if (!id_aceptacion) return res.status(400).json({ message: "sindata" });
            const aceptacion = await new ConsentimientoAceptacion().seleccionarPorId(id_aceptacion);
            if (!aceptacion) return res.status(404).json({ message: "noEncontrado" });
            if (!CORREO_VALIDO.test(String(aceptacion.paciente_correo || ""))) return res.status(422).json({ message: "correoInvalido" });

            const pdf = await descargarArchivoComoBuffer(aceptacion.pdf_key);
            if (sha256(pdf) !== aceptacion.pdf_sha256) {
                console.error("[CONSENTIMIENTOS] la constancia guardada no coincide con su huella:", aceptacion.codigo_verificacion);
                return res.status(500).json({ message: "serverError" });
            }
            const empresa = await datosEmpresa();
            const enviado = await enviarCorreo({
                empresa, para: aceptacion.paciente_correo, nombre: `${aceptacion.paciente_nombre} ${aceptacion.paciente_apellido}`,
                asunto: `Constancia de tu consentimiento - ${empresa.empresaNombre || "Centro de salud"}`,
                html: htmlConstancias({ empresa, nombrePaciente: aceptacion.paciente_nombre }),
                adjuntos: [{ nombre: `${aceptacion.codigo}-${aceptacion.codigo_verificacion}.pdf`, contenido: pdf }],
            });
            if (!enviado) return res.status(503).json({ message: "servicioOcupado" });
            await registrarAcceso({ id_aceptacion, accion: "enviado", usuario: req.usuario, contexto: req.contexto, destinatario: aceptacion.paciente_correo });
            return res.status(200).json({ message: true, enviadoA: enmascararCorreo(aceptacion.paciente_correo) });
        } catch (error) {
            console.error("[CONSENTIMIENTOS] enviarAceptacionCorreo:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }

    // POST /consentimientos/revocarAceptacion (auth, administrador)
    // Derecho del paciente (Ley 21.719): rige desde ahora, no borra la constancia.
    static async revocarAceptacion(req, res) {
        const conexion = await DataBase.getInstance().obtenerConexion();
        try {
            if (!esAdministrador(req.usuario)) return res.status(403).json({ message: "sinPermiso" });
            const { id_aceptacion } = req.body || {};
            const motivo = String(req.body?.motivo ?? "").trim().slice(0, 500);
            if (!id_aceptacion || !motivo) return res.status(400).json({ message: "sindata" });

            await conexion.beginTransaction();
            const ahora = ahoraUtc();
            const [resultado] = await new ConsentimientoAceptacion().revocar(conexion, id_aceptacion, req.usuario.idUsuario, motivo, aMysqlUtc(ahora));
            if (!resultado.affectedRows) {
                await conexion.rollback();
                return res.status(409).json({ message: "conflicto" });
            }
            await registrarEvento(conexion, {
                tipo_evento: "consentimiento_revocado", id_aceptacion, actor_tipo: "operador",
                actor_usuario: req.usuario.idUsuario, actor_clerk_id: req.usuario.clerkId, actor_nombre: req.usuario.nombre,
                metodo_autenticacion: "clerk_sesion", autenticado_at: ahora, ip: req.contexto?.ip, user_agent: req.contexto?.userAgent,
                datos: { motivo },
            });
            await conexion.commit();
            return res.status(200).json({ message: true });
        } catch (error) {
            await conexion.rollback().catch(() => {});
            console.error("[CONSENTIMIENTOS] revocarAceptacion:", error.message);
            return res.status(500).json({ message: "serverError" });
        } finally {
            conexion.release();
        }
    }
}
