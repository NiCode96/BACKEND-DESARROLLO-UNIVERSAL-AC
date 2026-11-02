import DataBase from "../config/Database.js";
import { sqlIso } from "../services/firma/tiempo.js";

/* Consentimientos aceptados en la reserva pública (tabla consentimiento_aceptacion).
 * Cada fila es UNA aceptación (hoy, la política de privacidad: el único texto con casilla);
 * las dos de una misma reserva comparten token_aceptacion. */

const COLUMNAS_PUBLICAS = `
    BIN_TO_UUID(a.id_aceptacion) AS id_aceptacion, a.codigo_verificacion, a.plantilla_codigo AS codigo,
    p.titulo, a.plantilla_version AS version, ${sqlIso("a.aceptado_at", "aceptado_at")}, a.origen,
    ${sqlIso("a.revocado_at", "revocado_at")}, a.id_paciente, a.id_reserva`;

export default class ConsentimientoAceptacion {

    //INSERTAR UNA ACEPTACION (DENTRO DE UNA TRANSACCION)
    async insertar(conexion, a) {
        const query = `
            INSERT INTO consentimiento_aceptacion (
                id_aceptacion, token_aceptacion, codigo_verificacion, id_plantilla, plantilla_codigo,
                plantilla_version, plantilla_sha256, texto_renderizado, texto_sha256, id_profesional,
                paciente_nombre, paciente_apellido, paciente_tipo_documento, paciente_documento,
                paciente_correo, paciente_telefono, origen, aceptado_at, ip, user_agent, pdf_key, pdf_sha256
            ) VALUES (UUID_TO_BIN(?), ?, ?, UUID_TO_BIN(?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'web', ?, ?, ?, ?, ?)`;
        return conexion.query(query, [
            a.id_aceptacion, a.token_aceptacion, a.codigo_verificacion, a.id_plantilla, a.plantilla_codigo,
            a.plantilla_version, a.plantilla_sha256, a.texto_renderizado, a.texto_sha256, a.id_profesional,
            a.paciente_nombre, a.paciente_apellido, a.paciente_tipo_documento, a.paciente_documento,
            a.paciente_correo, a.paciente_telefono, a.aceptado_at, a.ip, a.user_agent, a.pdf_key, a.pdf_sha256,
        ]);
    }

    //VINCULAR LAS ACEPTACIONES DE UN TOKEN CON LA RESERVA Y EL PACIENTE
    // El paciente se busca por su documento sin puntos ni guion (en pacienteDatos
    // el RUT puede estar guardado con o sin formato).
    async vincularReserva(token, id_reserva, documentoLimpio, vinculadoAt) {
        const query = `
            UPDATE consentimiento_aceptacion
            SET id_reserva = ?,
                id_paciente = (
                    SELECT id_paciente FROM pacienteDatos
                    WHERE REPLACE(REPLACE(UPPER(rut), '.', ''), '-', '') = ? AND estado_paciente <> 0
                    LIMIT 1
                ),
                vinculado_at = ?
            WHERE token_aceptacion = ? AND vinculado_at IS NULL`;
        return DataBase.getInstance().ejecutarQuery(query, [id_reserva, documentoLimpio, vinculadoAt, token]);
    }

    //LISTAR LAS ACEPTACIONES DE UN PACIENTE (POR ID O POR SU DOCUMENTO)
    async listarPorPaciente(id_paciente, documentoLimpio) {
        const query = `
            SELECT ${COLUMNAS_PUBLICAS}
            FROM consentimiento_aceptacion a
            JOIN documento_plantilla p ON p.id_plantilla = a.id_plantilla
            WHERE a.id_paciente = ? OR (? <> '' AND a.paciente_documento = ?)
            ORDER BY a.aceptado_at DESC`;
        return DataBase.getInstance().ejecutarQuery(query, [id_paciente, documentoLimpio, documentoLimpio]);
    }

    //SELECCIONAR UNA ACEPTACION CON SUS DATOS PRIVADOS (PARA DESCARGAR O ENVIAR)
    async seleccionarPorId(id_aceptacion) {
        const query = `
            SELECT ${COLUMNAS_PUBLICAS}, a.pdf_key, a.pdf_sha256, a.paciente_correo,
                   a.paciente_nombre, a.paciente_apellido, a.paciente_documento
            FROM consentimiento_aceptacion a
            JOIN documento_plantilla p ON p.id_plantilla = a.id_plantilla
            WHERE a.id_aceptacion = UUID_TO_BIN(?)`;
        const filas = await DataBase.getInstance().ejecutarQuery(query, [id_aceptacion]);
        return filas[0] || null;
    }

    //REVOCAR (NO BORRA: LA CONSTANCIA SE CONSERVA)
    async revocar(conexion, id_aceptacion, idUsuario, motivo, revocadoAt) {
        const query = `
            UPDATE consentimiento_aceptacion
            SET revocado_at = ?, revocado_por_usuario = UUID_TO_BIN(?), motivo_revocacion = ?
            WHERE id_aceptacion = UUID_TO_BIN(?) AND revocado_at IS NULL`;
        return conexion.query(query, [revocadoAt, idUsuario, motivo, id_aceptacion]);
    }
}
