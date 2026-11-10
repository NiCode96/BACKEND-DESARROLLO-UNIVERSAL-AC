import DataBase from "../config/Database.js";
import DocumentoPlantilla from "../model/DocumentoPlantilla.js";
import ProfesionalFirma, { aObjetoFirma } from "../model/ProfesionalFirma.js";
import RegistroSis, { aObjetoRegistro } from "../model/RegistroSis.js";
import { nuevoId } from "../services/firma/identificadores.js";
import { ahoraUtc, aMysqlUtc } from "../services/firma/tiempo.js";
import { sha256 } from "../services/firma/huellas.js";
import { registrarEvento } from "../services/firma/cadenaEvidencia.js";
import { limitarEstampado } from "../services/firma/limitador.js";
import { normalizarFirma, trazosValidos } from "../services/firma/procesarImagenFirma.js";
import { tipoPorFirmaMagica } from "../middleware/limitesArchivos.js";
import { esAdministrador, esProfesionalDueno } from "../services/firma/roles.js";
import { construirKeyPrivada, subirArchivo, eliminarArchivoR2, descargarArchivoComoBuffer } from "../services/r2Storage.js";

/* Firma (grafía) del profesional. Contrato: docs/firma/02 §4.
 *
 * Solo el propio profesional dibuja y registra su firma (nunca un tercero), con
 * reverificación de Clerk de los últimos 10 minutos y aceptando el acta de
 * adhesión vigente. La imagen se normaliza en el servidor y se guarda en R2
 * privado; en la BD solo queda su clave y su huella. */

const versionTexto = (version) => `${version}.0`;
const coincideVersion = (enviada, version) => [String(version), versionTexto(version)].includes(String(enviada ?? "").trim());

function actor(req) {
    return {
        actor_tipo: "profesional",
        actor_usuario: req.usuario.idUsuario,
        actor_clerk_id: req.usuario.clerkId,
        actor_nombre: req.usuario.nombre,
        ip: req.contexto?.ip,
        user_agent: req.contexto?.userAgent,
    };
}

export default class FirmaProfesionalController {

    // POST /firmaProfesional/seleccionarEstadoFirma
    static async seleccionarEstadoFirma(req, res) {
        try {
            const id_profesional = Number(req.body?.id_profesional);
            if (!id_profesional) return res.status(400).json({ message: "sindata" });
            if (!esAdministrador(req.usuario) && !esProfesionalDueno(req.usuario, id_profesional)) {
                return res.status(403).json({ message: "sinPermiso" });
            }
            const registro = await new RegistroSis().seleccionar(id_profesional);
            if (!registro) return res.status(404).json({ message: "noEncontrado" });
            const firma = await new ProfesionalFirma().seleccionarActiva(id_profesional);
            return res.status(200).json({ message: true, firma: aObjetoFirma(firma), registroSis: aObjetoRegistro(registro) });
        } catch (error) {
            console.error("[FIRMA] seleccionarEstadoFirma:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }

    // POST /firmaProfesional/seleccionarActaVigente
    static async seleccionarActaVigente(req, res) {
        try {
            const acta = await new DocumentoPlantilla().seleccionarVigentePorCodigo("acta_adhesion_fes");
            if (!acta) return res.status(503).json({ message: "serverError" });
            return res.status(200).json({
                message: true,
                acta: { version: versionTexto(acta.version), titulo: acta.titulo, cuerpo: acta.cuerpo, sha256: acta.sha256 },
            });
        } catch (error) {
            console.error("[FIRMA] seleccionarActaVigente:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }

    // POST /firmaProfesional/registrarFirma (multipart; reverificación obligatoria)
    static async registrarFirma(req, res) {
        const subidos = [];
        try {
            const id_profesional = Number(req.body?.id_profesional);
            const { tinta, acta_version, acta_aceptada } = req.body || {};
            if (!id_profesional || !req.file || !["azul", "negro"].includes(tinta)) return res.status(400).json({ message: "sindata" });
            // La firma la dibuja y registra SOLO su titular (un administrador tampoco).
            if (!esProfesionalDueno(req.usuario, id_profesional)) return res.status(403).json({ message: "sinPermiso" });
            if (acta_aceptada !== "true") return res.status(409).json({ message: "actaNoAceptada" });

            const acta = await new DocumentoPlantilla().seleccionarVigentePorCodigo("acta_adhesion_fes");
            if (!acta) return res.status(503).json({ message: "serverError" });
            if (!coincideVersion(acta_version, acta.version)) return res.status(409).json({ message: "actaDesactualizada" });

            let trazos;
            try { trazos = JSON.parse(req.body.trazos || "null"); } catch { trazos = null; }
            if (!trazosValidos(trazos)) return res.status(400).json({ message: "sindata" });
            if (tipoPorFirmaMagica(req.file.buffer) !== "image/png") return res.status(422).json({ message: "pngInvalido" });

            // Trabajo pesado fuera de la transacción.
            const imagen = await limitarEstampado(() => normalizarFirma(req.file.buffer));
            const trazosBuffer = Buffer.from(JSON.stringify(trazos), "utf8");
            const imagenKey = construirKeyPrivada("firmas", "png");
            const trazosKey = construirKeyPrivada("firmas-trazos", "json");
            await subirArchivo(imagen.buffer, imagenKey, "image/png");
            subidos.push(imagenKey);
            await subirArchivo(trazosBuffer, trazosKey, "application/json");
            subidos.push(trazosKey);

            const ahora = ahoraUtc();
            const firma = {
                id_firma: nuevoId(), id_profesional, tinta,
                imagen_key: imagenKey, imagen_sha256: sha256(imagen.buffer), ancho_px: imagen.ancho, alto_px: imagen.alto,
                trazos_key: trazosKey, trazos_sha256: sha256(trazosBuffer),
                id_plantilla_acta: acta.id_plantilla, acta_sha256: acta.sha256, acta_aceptada_at: aMysqlUtc(ahora),
                id_usuario: req.usuario.idUsuario, clerk_user_id: req.usuario.clerkId,
                ip: req.contexto?.ip, user_agent: req.contexto?.userAgent, registrada_at: aMysqlUtc(ahora),
            };

            const conexion = await DataBase.getInstance().obtenerConexion();
            try {
                await conexion.beginTransaction();
                const modelo = new ProfesionalFirma();
                const anterior = await modelo.seleccionarActiva(id_profesional, conexion);
                const base = { ...actor(req), id_profesional, metodo_autenticacion: req.reverificacion.metodo, autenticado_at: req.reverificacion.autenticadoAt };
                if (anterior) {
                    await modelo.cerrar(conexion, anterior.id_firma, "reemplazada", "Reemplazada por una firma nueva", aMysqlUtc(ahora));
                    await registrarEvento(conexion, { ...base, tipo_evento: "firma_reemplazada", id_firma: anterior.id_firma, datos: { reemplazada_por: firma.id_firma } });
                }
                await modelo.insertar(conexion, firma);
                await registrarEvento(conexion, {
                    ...base, tipo_evento: "acta_aceptada", id_firma: firma.id_firma, documento_sha256: acta.sha256,
                    datos: { acta_codigo: acta.codigo, acta_version: acta.version, acta_sha256: acta.sha256 },
                });
                await registrarEvento(conexion, {
                    ...base, tipo_evento: "firma_registrada", id_firma: firma.id_firma, documento_sha256: firma.imagen_sha256,
                    datos: { tinta, ancho_px: firma.ancho_px, alto_px: firma.alto_px, trazos_sha256: firma.trazos_sha256 },
                });
                await conexion.commit();
            } catch (error) {
                await conexion.rollback().catch(() => {});
                throw error;
            } finally {
                conexion.release();
            }
            subidos.length = 0;

            const guardada = await new ProfesionalFirma().seleccionarActiva(id_profesional);
            return res.status(200).json({ message: true, firma: aObjetoFirma(guardada) });
        } catch (error) {
            for (const key of subidos) eliminarArchivoR2(key).catch(() => {});
            if (error.codigo === "pngInvalido") return res.status(422).json({ message: "pngInvalido" });
            if (error.codigo === "servicioOcupado") return res.status(503).json({ message: "servicioOcupado" });
            console.error("[FIRMA] registrarFirma:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }

    // POST /firmaProfesional/seleccionarImagenFirma → PNG directo, solo al titular
    static async seleccionarImagenFirma(req, res) {
        try {
            const id_profesional = Number(req.body?.id_profesional);
            if (!id_profesional) return res.status(400).json({ message: "sindata" });
            if (!esProfesionalDueno(req.usuario, id_profesional)) return res.status(403).json({ message: "sinPermiso" });
            const firma = await new ProfesionalFirma().seleccionarActiva(id_profesional);
            if (!firma) return res.status(409).json({ message: "firmaInexistente" });
            const png = await descargarArchivoComoBuffer(firma.imagen_key);
            if (sha256(png) !== firma.imagen_sha256) {
                console.error("[FIRMA] la imagen guardada no coincide con su huella:", firma.id_firma);
                return res.status(500).json({ message: "serverError" });
            }
            res.set({ "Content-Type": "image/png", "Cache-Control": "no-store", "Content-Disposition": "inline" });
            return res.status(200).send(png);
        } catch (error) {
            console.error("[FIRMA] seleccionarImagenFirma:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }

    // POST /firmaProfesional/revocarFirma (reverificación obligatoria)
    // Los documentos ya firmados NO se tocan: siguen siendo válidos.
    static async revocarFirma(req, res) {
        const conexion = await DataBase.getInstance().obtenerConexion();
        try {
            const id_profesional = Number(req.body?.id_profesional);
            const motivo = String(req.body?.motivo ?? "").trim().slice(0, 255) || "Revocada por el usuario";
            if (!id_profesional) return res.status(400).json({ message: "sindata" });
            const dueno = esProfesionalDueno(req.usuario, id_profesional);
            if (!dueno && !esAdministrador(req.usuario)) return res.status(403).json({ message: "sinPermiso" });

            await conexion.beginTransaction();
            const modelo = new ProfesionalFirma();
            const firma = await modelo.seleccionarActiva(id_profesional, conexion);
            if (!firma) {
                await conexion.rollback();
                return res.status(409).json({ message: "firmaInexistente" });
            }
            const ahora = ahoraUtc();
            await modelo.cerrar(conexion, firma.id_firma, "revocada", motivo, aMysqlUtc(ahora));
            await registrarEvento(conexion, {
                ...actor(req), actor_tipo: dueno ? "profesional" : "operador", tipo_evento: "firma_revocada",
                id_firma: firma.id_firma, id_profesional, metodo_autenticacion: req.reverificacion.metodo,
                autenticado_at: req.reverificacion.autenticadoAt, datos: { motivo },
            });
            await conexion.commit();
            return res.status(200).json({ message: true });
        } catch (error) {
            await conexion.rollback().catch(() => {});
            console.error("[FIRMA] revocarFirma:", error.message);
            return res.status(500).json({ message: "serverError" });
        } finally {
            conexion.release();
        }
    }
}
