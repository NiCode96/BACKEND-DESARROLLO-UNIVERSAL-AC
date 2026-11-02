import DatosEmpresa from "../model/DatosEmpresa.js";
import Verificacion from "../model/Verificacion.js";
import { FORMATO_CODIGO } from "../services/firma/identificadores.js";
import { sha256, huellasIguales } from "../services/firma/huellas.js";
import { isoDesdeMysql } from "../services/firma/tiempo.js";
import { registrarAcceso } from "../services/firma/bitacora.js";

/* Verificación pública de documentos y constancias (destino del QR).
 * Contrato: docs/firma/02 §8.
 *
 * Ley 21.719: solo se informa si el documento existe, quién lo emitió, cuándo y
 * su estado. NUNCA el paciente, el contenido ni la huella completa. */

const normalizar = (codigo) => String(codigo ?? "").trim().toUpperCase();

export default class VerificacionController {

    // GET /verificacion/:codigo
    static async verificarCodigo(req, res) {
        try {
            const codigo = normalizar(req.params.codigo);
            res.set("Cache-Control", "no-store");
            if (!FORMATO_CODIGO.test(codigo)) return res.status(200).json({ message: true, existe: false });

            const modelo = new Verificacion();
            const empresa = (await new DatosEmpresa().seleccionarDatosEmpresa())?.[0] || {};
            const documento = await modelo.buscarDocumento(codigo);
            if (documento) {
                const id_documento = await modelo.idDocumentoPorCodigo(codigo);
                registrarAcceso({ id_documento, accion: "verificado_publico", contexto: { ip: req.ip, userAgent: req.get("user-agent") } })
                    .catch((error) => console.error("[VERIFICACION] bitácora:", error.message));
                return res.status(200).json({
                    message: true,
                    existe: true,
                    tipo: "documento",
                    tipo_documento: documento.tipo_documento,
                    estado: documento.estado,
                    emisor: {
                        nombre: documento.nombreProfesional,
                        profesion: documento.descripcionProfesional,
                        registro_sis: documento.registro_sis || null,
                    },
                    clinica: empresa.empresaNombre || null,
                    firmado_at: isoDesdeMysql(documento.firmado_at),
                    codigo,
                });
            }

            const consentimiento = await modelo.buscarConsentimiento(codigo);
            if (consentimiento) {
                registrarAcceso({ id_aceptacion: consentimiento.id_aceptacion, accion: "verificado_publico", contexto: { ip: req.ip, userAgent: req.get("user-agent") } })
                    .catch((error) => console.error("[VERIFICACION] bitácora:", error.message));
                return res.status(200).json({
                    message: true,
                    existe: true,
                    tipo: "consentimiento",
                    tipo_documento: consentimiento.plantilla_codigo,
                    estado: "firmado",
                    revocado_at: isoDesdeMysql(consentimiento.revocado_at),
                    emisor: null,
                    clinica: empresa.empresaNombre || null,
                    firmado_at: isoDesdeMysql(consentimiento.aceptado_at),
                    codigo,
                });
            }

            return res.status(200).json({ message: true, existe: false });
        } catch (error) {
            console.error("[VERIFICACION] verificarCodigo:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }

    // POST /verificacion/compararHash (multipart: codigo, pdf)
    // El servidor calcula la huella del archivo recibido y la compara con la guardada.
    static async compararHash(req, res) {
        try {
            const codigo = normalizar(req.body?.codigo);
            if (!req.file || !FORMATO_CODIGO.test(codigo)) return res.status(400).json({ message: "sindata" });

            const modelo = new Verificacion();
            const guardado = (await modelo.buscarDocumento(codigo))?.pdf_sha256
                || (await modelo.buscarConsentimiento(codigo))?.pdf_sha256;
            if (!guardado) return res.status(404).json({ message: "noEncontrado" });

            return res.status(200).json({ message: true, coincide: huellasIguales(sha256(req.file.buffer), guardado) });
        } catch (error) {
            console.error("[VERIFICACION] compararHash:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }
}
