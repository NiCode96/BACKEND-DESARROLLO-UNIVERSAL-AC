import DataBase from "../config/Database.js";
import { sqlIso, isoDesdeMysql } from "../services/firma/tiempo.js";

/* N° de registro en la Superintendencia de Salud de cada profesional (columnas
 * registro_sis_* de profesionales). Estados: no_informado → declarado (lo
 * ingresó el profesional o un administrador) → verificado / rechazado (lo
 * revisó un administrador contra el Registro Nacional de Prestadores). */

/** Fila → objeto `registroSis` del contrato (sin la clave R2 del certificado). */
export function aObjetoRegistro(fila) {
    return {
        numero: fila?.registro_sis_numero || null,
        estado: fila?.registro_sis_estado || "no_informado",
        tiene_certificado: Boolean(fila?.registro_sis_certificado_key),
        verificado_por: fila?.verificado_por_nombre || null,
        verificado_at: isoDesdeMysql(fila?.registro_sis_verificado_at),
        motivo_rechazo: fila?.registro_sis_motivo_rechazo || null,
    };
}

export default class RegistroSis {

    async seleccionar(id_profesional, conexion = null) {
        const query = `
            SELECT p.id_profesional, p.nombreProfesional, p.registro_sis_numero, p.registro_sis_estado,
                   p.registro_sis_certificado_key, p.registro_sis_certificado_mime, p.registro_sis_certificado_sha256,
                   ${sqlIso("p.registro_sis_verificado_at", "registro_sis_verificado_at")}, p.registro_sis_motivo_rechazo,
                   u.nombre AS verificado_por_nombre
            FROM profesionales p
            LEFT JOIN usuario_plataforma u ON u.id_usuario = p.registro_sis_verificado_por
            WHERE p.id_profesional = ? AND p.estado_Profesional <> 0
            ${conexion ? "FOR UPDATE" : ""}`;
        if (conexion) {
            const [filas] = await conexion.query(query, [id_profesional]);
            return filas[0] || null;
        }
        const filas = await DataBase.getInstance().ejecutarQuery(query, [id_profesional]);
        return filas[0] || null;
    }

    //DECLARAR O CAMBIAR EL NUMERO (VUELVE A "declarado" Y LIMPIA LA VERIFICACION)
    async declarar(conexion, id_profesional, numero, certificado) {
        const sets = [
            "registro_sis_numero = ?",
            "registro_sis_estado = ?",
            "registro_sis_verificado_por = NULL",
            "registro_sis_verificado_at = NULL",
            "registro_sis_motivo_rechazo = NULL",
        ];
        const params = [numero, numero ? "declarado" : "no_informado"];
        if (certificado) {
            sets.push("registro_sis_certificado_key = ?", "registro_sis_certificado_mime = ?", "registro_sis_certificado_sha256 = ?");
            params.push(certificado.key, certificado.mime, certificado.sha256);
        }
        params.push(id_profesional);
        return conexion.query(`UPDATE profesionales SET ${sets.join(", ")} WHERE id_profesional = ?`, params);
    }

    //SOLO REEMPLAZAR EL CERTIFICADO (EL NUMERO NO CAMBIA)
    async actualizarCertificado(conexion, id_profesional, certificado) {
        return conexion.query(
            `UPDATE profesionales SET registro_sis_certificado_key = ?, registro_sis_certificado_mime = ?,
             registro_sis_certificado_sha256 = ? WHERE id_profesional = ?`,
            [certificado.key, certificado.mime, certificado.sha256, id_profesional]
        );
    }

    async verificar(conexion, id_profesional, decision, motivo, idUsuario, ahora) {
        return conexion.query(
            `UPDATE profesionales SET registro_sis_estado = ?, registro_sis_verificado_por = UUID_TO_BIN(?),
             registro_sis_verificado_at = ?, registro_sis_motivo_rechazo = ?
             WHERE id_profesional = ? AND registro_sis_numero IS NOT NULL`,
            [decision, idUsuario, ahora, decision === "rechazado" ? motivo : null, id_profesional]
        );
    }
}
