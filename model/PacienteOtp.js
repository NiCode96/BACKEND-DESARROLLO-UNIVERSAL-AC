import DataBase from "../config/Database.js";
import { sqlIso } from "../services/firma/tiempo.js";

/* Códigos OTP para que el paciente acepte un consentimiento informado
 * (tabla paciente_otp). Nunca se guarda el código: solo su HMAC. */
export default class PacienteOtp {

    //CUANTOS CODIGOS SE PIDIERON PARA ESTE DOCUMENTO EN LOS ULTIMOS N MINUTOS (LIMITE DE TASA)
    async contarRecientes(id_documento, desde) {
        const filas = await DataBase.getInstance().ejecutarQuery(
            "SELECT COUNT(*) AS total FROM paciente_otp WHERE id_documento = UUID_TO_BIN(?) AND creado_at >= ?",
            [id_documento, desde]
        );
        return Number(filas[0]?.total || 0);
    }

    //UN CODIGO NUEVO DEJA INUTILIZABLES LOS ANTERIORES SIN VERIFICAR
    async invalidarPendientes(conexion, id_documento, ahora) {
        return conexion.query(
            "UPDATE paciente_otp SET expira_at = ? WHERE id_documento = UUID_TO_BIN(?) AND verificado_at IS NULL AND expira_at > ?",
            [ahora, id_documento, ahora]
        );
    }

    async insertar(conexion, o) {
        return conexion.query(
            `INSERT INTO paciente_otp (id_otp, id_documento, id_paciente, canal, destino_mascarado, codigo_hash, intentos, creado_at, expira_at)
             VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, ?, ?, 0, ?, ?)`,
            [o.id_otp, o.id_documento, o.id_paciente, o.canal, o.destino_mascarado, o.codigo_hash, o.creado_at, o.expira_at]
        );
    }

    async ultimo(conexion, id_documento) {
        const [filas] = await conexion.query(
            `SELECT BIN_TO_UUID(id_otp) AS id_otp, canal, destino_mascarado, codigo_hash, intentos,
                    ${sqlIso("expira_at")}, ${sqlIso("verificado_at")}
             FROM paciente_otp WHERE id_documento = UUID_TO_BIN(?) ORDER BY creado_at DESC LIMIT 1 FOR UPDATE`,
            [id_documento]
        );
        return filas[0] || null;
    }

    async sumarIntento(conexion, id_otp) {
        return conexion.query("UPDATE paciente_otp SET intentos = LEAST(intentos + 1, 5) WHERE id_otp = UUID_TO_BIN(?)", [id_otp]);
    }

    async marcarVerificado(conexion, id_otp, ahora, ip) {
        return conexion.query(
            "UPDATE paciente_otp SET verificado_at = ?, ip_verificacion = ? WHERE id_otp = UUID_TO_BIN(?) AND verificado_at IS NULL",
            [ahora, ip, id_otp]
        );
    }
}
