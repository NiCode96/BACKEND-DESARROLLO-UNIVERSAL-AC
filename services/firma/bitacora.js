/* Bitácora de accesos a documentos y constancias (tabla documento_acceso,
 * append-only). Responde a "¿quién vio, descargó, imprimió o envió este documento,
 * cuándo y desde dónde?" (Ley 21.719, deber de seguridad; Ley 20.584, reserva de
 * la ficha clínica).
 *
 * Regla: el acceso se registra ANTES de entregar el archivo. Si no se puede
 * registrar, la operación falla (el controlador no entrega la URL). */

import DataBase from "../../config/Database.js";
import { nuevoId } from "./identificadores.js";
import { ahoraUtc, aMysqlUtc } from "./tiempo.js";

/**
 * @param {object} p
 * @param {string} [p.id_documento]   UUID texto
 * @param {string} [p.id_aceptacion]  UUID texto
 * @param {string} p.accion           generado | visto | descargado | impreso | enviado | verificado_publico | impreso_manuscrito
 * @param {object} [p.usuario]        req.usuario (null en accesos públicos)
 * @param {object} [p.contexto]       req.contexto: { ip, userAgent }
 * @param {string} [p.destinatario]   solo para "enviado"
 * @param {object} [conexion]         conexión de una transacción abierta (opcional)
 */
export async function registrarAcceso({ id_documento = null, id_aceptacion = null, accion, usuario = null, contexto = {}, destinatario = null }, conexion = null) {
    const sql = `INSERT INTO documento_acceso (
            id_acceso, id_documento, id_aceptacion, accion, actor_usuario, actor_clerk_id,
            actor_nombre, actor_rol, destinatario, ip, user_agent, ocurrido_at
        ) VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), ?, UUID_TO_BIN(?), ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
        nuevoId(), id_documento, id_aceptacion, accion,
        usuario?.idUsuario ?? null, usuario?.clerkId ?? null, usuario?.nombre ?? null, usuario?.rol ?? null,
        destinatario, contexto?.ip ?? null, contexto?.userAgent ? String(contexto.userAgent).slice(0, 255) : null,
        aMysqlUtc(ahoraUtc()),
    ];
    if (conexion) return conexion.query(sql, params);
    return DataBase.getInstance().ejecutarQuery(sql, params);
}
