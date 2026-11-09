import DataBase from "../config/Database.js";
import RegistroSis, { aObjetoRegistro } from "../model/RegistroSis.js";
import { ahoraUtc, aMysqlUtc } from "../services/firma/tiempo.js";
import { sha256 } from "../services/firma/huellas.js";
import { registrarEvento } from "../services/firma/cadenaEvidencia.js";
import { registrarAcceso } from "../services/firma/bitacora.js";
import { tipoPorFirmaMagica } from "../middleware/limitesArchivos.js";
import { esAdministrador, esProfesionalDueno } from "../services/firma/roles.js";
import { construirKeyPrivada, subirArchivo, eliminarArchivoR2, generarUrlDescarga } from "../services/r2Storage.js";

/* N° de registro en la Superintendencia de Salud (docs/firma/02 §5).
 * El número aparece en el pie de firma de los documentos. Un administrador lo
 * verifica contra el Registro Nacional de Prestadores Individuales; si lo
 * rechaza, el número deja de imprimirse. */

const NUMERO_VALIDO = /^\d{1,10}$/;
const EXTENSION = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };

function evento(usuario, contexto) {
    return {
        actor_tipo: usuario ? "operador" : "sistema",
        actor_usuario: usuario?.idUsuario ?? null,
        actor_clerk_id: usuario?.clerkId ?? null,
        actor_nombre: usuario?.nombre ?? null,
        metodo_autenticacion: usuario ? "clerk_sesion" : "sin_sesion",
        autenticado_at: usuario ? ahoraUtc() : null,
        ip: contexto?.ip ?? null,
        user_agent: contexto?.userAgent ? String(contexto.userAgent).slice(0, 255) : null,
    };
}

/**
 * Declara (o cambia) el número y opcionalmente el certificado, con su evento.
 * La usa también ProfesionalesController al crear un profesional.
 */
export async function declararRegistroSis({ id_profesional, numero, certificado = null, usuario = null, contexto = {} }) {
    const conexion = await DataBase.getInstance().obtenerConexion();
    try {
        await conexion.beginTransaction();
        const modelo = new RegistroSis();
        const actual = await modelo.seleccionar(id_profesional, conexion);
        if (!actual) {
            await conexion.rollback();
            return null;
        }
        const cambiaNumero = (actual.registro_sis_numero || null) !== (numero || null);
        if (cambiaNumero) {
            await modelo.declarar(conexion, id_profesional, numero || null, certificado);
            await registrarEvento(conexion, {
                ...evento(usuario, contexto), tipo_evento: "registro_sis_declarado", id_profesional,
                documento_sha256: certificado?.sha256 ?? null,
                datos: { numero: numero || null, anterior: actual.registro_sis_numero || null, con_certificado: Boolean(certificado) },
            });
        } else if (certificado) {
            await modelo.actualizarCertificado(conexion, id_profesional, certificado);
        }
        await conexion.commit();
        return aObjetoRegistro(await modelo.seleccionar(id_profesional));
    } catch (error) {
        await conexion.rollback().catch(() => {});
        throw error;
    } finally {
        conexion.release();
    }
}

export default class RegistroSisController {

    // POST /profesionales/actualizarRegistroSis (multipart: id_profesional, registro_sis_numero, certificado?)
    static async actualizarRegistroSis(req, res) {
        let certificadoKey = null;
        try {
            const id_profesional = Number(req.body?.id_profesional);
            const numero = String(req.body?.registro_sis_numero ?? "").trim();
            if (!id_profesional) return res.status(400).json({ message: "sindata" });
            if (!esAdministrador(req.usuario) && !esProfesionalDueno(req.usuario, id_profesional)) {
                return res.status(403).json({ message: "sinPermiso" });
            }
            if (numero && !NUMERO_VALIDO.test(numero)) return res.status(422).json({ message: "datoinvalido" });

            let certificado = null;
            if (req.file) {
                // El tipo se comprueba por los primeros bytes, no por lo que dice el navegador.
                const mime = tipoPorFirmaMagica(req.file.buffer);
                if (!EXTENSION[mime]) return res.status(422).json({ message: "archivoInvalido" });
                certificadoKey = construirKeyPrivada("registro-sis", EXTENSION[mime]);
                await subirArchivo(req.file.buffer, certificadoKey, mime);
                certificado = { key: certificadoKey, mime, sha256: sha256(req.file.buffer) };
            }

            const registroSis = await declararRegistroSis({ id_profesional, numero, certificado, usuario: req.usuario, contexto: req.contexto });
            if (!registroSis) {
                if (certificadoKey) eliminarArchivoR2(certificadoKey).catch(() => {});
                return res.status(404).json({ message: "noEncontrado" });
            }
            return res.status(200).json({ message: true, registroSis });
        } catch (error) {
            if (certificadoKey) eliminarArchivoR2(certificadoKey).catch(() => {});
            console.error("[FIRMA] actualizarRegistroSis:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }

    // POST /profesionales/verificarRegistroSis (solo administrador)
    static async verificarRegistroSis(req, res) {
        const conexion = await DataBase.getInstance().obtenerConexion();
        try {
            if (!esAdministrador(req.usuario)) return res.status(403).json({ message: "sinPermiso" });
            const id_profesional = Number(req.body?.id_profesional);
            const { decision } = req.body || {};
            const motivo = String(req.body?.motivo ?? "").trim().slice(0, 500);
            if (!id_profesional || !["verificado", "rechazado"].includes(decision)) return res.status(400).json({ message: "sindata" });
            if (decision === "rechazado" && !motivo) return res.status(400).json({ message: "sindata" });

            await conexion.beginTransaction();
            const ahora = ahoraUtc();
            const [resultado] = await new RegistroSis().verificar(conexion, id_profesional, decision, motivo, req.usuario.idUsuario, aMysqlUtc(ahora));
            if (!resultado.affectedRows) {
                await conexion.rollback();
                return res.status(409).json({ message: "conflicto" }); // sin número declarado
            }
            await registrarEvento(conexion, {
                ...evento(req.usuario, req.contexto),
                tipo_evento: decision === "verificado" ? "registro_sis_verificado" : "registro_sis_rechazado",
                id_profesional, datos: { decision, motivo: motivo || null },
            });
            await conexion.commit();
            return res.status(200).json({ message: true, registroSis: aObjetoRegistro(await new RegistroSis().seleccionar(id_profesional)) });
        } catch (error) {
            await conexion.rollback().catch(() => {});
            console.error("[FIRMA] verificarRegistroSis:", error.message);
            return res.status(500).json({ message: "serverError" });
        } finally {
            conexion.release();
        }
    }

    // POST /profesionales/descargarCertificadoSis → URL firmada de 60 s
    static async descargarCertificadoSis(req, res) {
        try {
            const id_profesional = Number(req.body?.id_profesional);
            if (!id_profesional) return res.status(400).json({ message: "sindata" });
            if (!esAdministrador(req.usuario) && !esProfesionalDueno(req.usuario, id_profesional)) {
                return res.status(403).json({ message: "sinPermiso" });
            }
            const registro = await new RegistroSis().seleccionar(id_profesional);
            if (!registro?.registro_sis_certificado_key) return res.status(404).json({ message: "noEncontrado" });
            const extension = EXTENSION[registro.registro_sis_certificado_mime] || "pdf";
            const nombre = `certificado-registro-sis-${id_profesional}.${extension}`;
            const url = await generarUrlDescarga(registro.registro_sis_certificado_key, 60, { nombre, tipo: registro.registro_sis_certificado_mime });
            res.set("Cache-Control", "no-store");
            return res.status(200).json({
                message: true, url, nombre, sha256: registro.registro_sis_certificado_sha256,
                expira_at: new Date(Date.now() + 60_000).toISOString(),
            });
        } catch (error) {
            console.error("[FIRMA] descargarCertificadoSis:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }
}
