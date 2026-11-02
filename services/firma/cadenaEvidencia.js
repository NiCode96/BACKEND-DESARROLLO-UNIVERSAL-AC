/* Cadena de evidencia de la firma electrónica (tabla firma_evento).
 *
 * Cada evento (firma registrada, documento firmado, consentimiento aceptado…)
 * guarda la huella del evento anterior. Si alguien altera o borra una fila, la
 * cadena se rompe desde ahí y scripts/verificar_cadena_firma.mjs lo detecta.
 * Además cada huella va sellada con HMAC (FIRMA_HMAC_CLAVE): sin la clave no se
 * puede rehacer la cadena para tapar una alteración.
 *
 * Se llama SIEMPRE dentro de una transacción abierta (`conexion` de
 * DataBase.getInstance().obtenerConexion()). El SELECT … FOR UPDATE sobre la fila
 * única de firma_cadena_estado pone en fila a los eventos simultáneos: así dos
 * firmas al mismo tiempo nunca reciben la misma secuencia. */

import { nuevoId } from "./identificadores.js";
import { ahoraUtc, aMysqlUtc } from "./tiempo.js";
import { sha256, hmacSha256, canonico, claveHmac } from "./huellas.js";

const aIso = (valor) => (valor ? new Date(valor).toISOString() : null);

/** Campos que entran en la huella, en forma canónica. Lo usa también el verificador. */
export function camposCanonicos(e) {
    return {
        secuencia: Number(e.secuencia),
        tipo_evento: e.tipo_evento,
        id_evento: e.id_evento,
        id_documento: e.id_documento ?? null,
        id_firma: e.id_firma ?? null,
        id_aceptacion: e.id_aceptacion ?? null,
        id_profesional: e.id_profesional != null ? Number(e.id_profesional) : null,
        id_paciente: e.id_paciente != null ? Number(e.id_paciente) : null,
        actor_tipo: e.actor_tipo,
        actor_clerk_id: e.actor_clerk_id ?? null,
        actor_nombre: e.actor_nombre ?? null,
        metodo_autenticacion: e.metodo_autenticacion,
        autenticado_at: aIso(e.autenticado_at),
        documento_sha256: e.documento_sha256 ?? null,
        datos_json: e.datos_json ?? {},
        ip: e.ip ?? null,
        user_agent: e.user_agent ?? null,
        ocurrido_at: aIso(e.ocurrido_at),
        hash_anterior: e.hash_anterior,
    };
}

/**
 * Inserta un evento encadenado. `evento`:
 *  { tipo_evento, actor_tipo, metodo_autenticacion, datos?, id_documento?, id_firma?,
 *    id_aceptacion?, id_profesional?, id_paciente?, actor_usuario?, actor_clerk_id?,
 *    actor_nombre?, autenticado_at?, documento_sha256?, ip?, user_agent? }
 * Los id_* de tipo UUID van como texto ("0192…").
 */
export async function registrarEvento(conexion, evento) {
    const { clave, version } = claveHmac();
    const [[estado]] = await conexion.query(
        "SELECT ultima_secuencia, ultimo_hash FROM firma_cadena_estado WHERE id = 1 FOR UPDATE"
    );
    if (!estado) throw new Error("[FIRMA] falta la fila de firma_cadena_estado (correr la migración)");

    const ocurridoAt = ahoraUtc();
    const registro = {
        ...evento,
        id_evento: nuevoId(),
        secuencia: Number(estado.ultima_secuencia) + 1,
        ocurrido_at: ocurridoAt,
        hash_anterior: estado.ultimo_hash,
        // Ida y vuelta por JSON: deja los datos exactamente como los devolverá MySQL
        // (sin undefined, fechas como texto), así la huella se puede recalcular después.
        datos_json: JSON.parse(JSON.stringify(evento.datos ?? {})),
        user_agent: evento.user_agent ? String(evento.user_agent).slice(0, 255) : null,
    };
    const hashEvento = sha256(canonico(camposCanonicos(registro)));
    const sello = hmacSha256(clave, hashEvento);

    await conexion.query(
        `INSERT INTO firma_evento (
            id_evento, secuencia, tipo_evento, id_documento, id_firma, id_aceptacion,
            id_profesional, id_paciente, actor_tipo, actor_usuario, actor_clerk_id, actor_nombre,
            metodo_autenticacion, autenticado_at, documento_sha256, datos_json, ip, user_agent,
            ocurrido_at, hash_anterior, hash_evento, sello_hmac, clave_version
        ) VALUES (UUID_TO_BIN(?), ?, ?, UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?),
                  ?, ?, ?, UUID_TO_BIN(?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            registro.id_evento, registro.secuencia, registro.tipo_evento,
            registro.id_documento ?? null, registro.id_firma ?? null, registro.id_aceptacion ?? null,
            registro.id_profesional ?? null, registro.id_paciente ?? null, registro.actor_tipo,
            registro.actor_usuario ?? null, registro.actor_clerk_id ?? null, registro.actor_nombre ?? null,
            registro.metodo_autenticacion,
            registro.autenticado_at ? aMysqlUtc(new Date(registro.autenticado_at)) : null,
            registro.documento_sha256 ?? null, JSON.stringify(registro.datos_json),
            registro.ip ?? null, registro.user_agent, aMysqlUtc(ocurridoAt),
            registro.hash_anterior, hashEvento, sello, version,
        ]
    );
    await conexion.query(
        "UPDATE firma_cadena_estado SET ultima_secuencia = ?, ultimo_hash = ? WHERE id = 1",
        [registro.secuencia, hashEvento]
    );
    return { id_evento: registro.id_evento, secuencia: registro.secuencia, hash_evento: hashEvento };
}
