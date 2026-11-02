import DataBase from "../config/Database.js";
import { sqlIso } from "../services/firma/tiempo.js";

/* Consultas de la verificación pública (/verificar/[codigo]). Solo devuelven lo
 * que se puede mostrar a cualquiera: tipo, emisor, fecha y estado. Nunca datos
 * del paciente ni contenido (Ley 21.719). */
export default class Verificacion {

    async buscarDocumento(codigo) {
        const query = `
            SELECT d.tipo_documento, d.estado, ${sqlIso("d.firmado_at", "firmado_at")}, d.pdf_sha256,
                   p.nombreProfesional, p.descripcionProfesional,
                   IF(p.registro_sis_estado IN ('declarado','verificado'), p.registro_sis_numero, NULL) AS registro_sis
            FROM documento_emitido d
            JOIN profesionales p ON p.id_profesional = d.id_profesional_firmante
            WHERE d.codigo_verificacion = ? AND d.estado IN ('firmado','anulado')
            LIMIT 1`;
        const filas = await DataBase.getInstance().ejecutarQuery(query, [codigo]);
        return filas[0] || null;
    }

    async buscarConsentimiento(codigo) {
        const query = `
            SELECT BIN_TO_UUID(id_aceptacion) AS id_aceptacion, plantilla_codigo, pdf_sha256,
                   ${sqlIso("aceptado_at")}, ${sqlIso("revocado_at")}
            FROM consentimiento_aceptacion
            WHERE codigo_verificacion = ?
            LIMIT 1`;
        const filas = await DataBase.getInstance().ejecutarQuery(query, [codigo]);
        return filas[0] || null;
    }

    async idDocumentoPorCodigo(codigo) {
        const filas = await DataBase.getInstance().ejecutarQuery(
            "SELECT BIN_TO_UUID(id_documento) AS id_documento FROM documento_emitido WHERE codigo_verificacion = ?",
            [codigo]
        );
        return filas[0]?.id_documento || null;
    }
}
