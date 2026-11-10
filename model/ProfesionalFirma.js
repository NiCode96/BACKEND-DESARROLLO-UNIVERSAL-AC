import DataBase from "../config/Database.js";
import { sqlIso, isoDesdeMysql } from "../services/firma/tiempo.js";

/* Firma (grafía) de cada profesional (tabla profesional_firma). Una sola activa
 * por profesional (índice único sobre la columna generada activa_de). Las
 * anteriores quedan como "reemplazada" o "revocada": nunca se borran, porque los
 * documentos ya firmados apuntan a ellas. */

const COLUMNAS = `
    BIN_TO_UUID(f.id_firma) AS id_firma, f.id_profesional, f.estado, f.tinta, f.ancho_px, f.alto_px,
    f.imagen_sha256, p.version AS acta_version_numero, ${sqlIso("f.registrada_at", "registrada_at")}`;

/** Fila → objeto `firma` del contrato (sin claves R2). */
export function aObjetoFirma(fila) {
    if (!fila) return null;
    return {
        id_firma: fila.id_firma,
        id_profesional: fila.id_profesional,
        estado: fila.estado,
        tinta: fila.tinta,
        ancho_px: fila.ancho_px,
        alto_px: fila.alto_px,
        imagen_sha256: fila.imagen_sha256,
        acta_version: fila.acta_version_numero != null ? `${fila.acta_version_numero}.0` : null,
        registrada_at: isoDesdeMysql(fila.registrada_at),
    };
}

export default class ProfesionalFirma {

    //FIRMA ACTIVA DE UN PROFESIONAL (CON SUS CLAVES PRIVADAS, SOLO PARA USO INTERNO)
    async seleccionarActiva(id_profesional, conexion = null) {
        const query = `
            SELECT ${COLUMNAS}, f.imagen_key, f.trazos_key
            FROM profesional_firma f
            JOIN documento_plantilla p ON p.id_plantilla = f.id_plantilla_acta
            WHERE f.id_profesional = ? AND f.estado = 'activa'
            LIMIT 1 ${conexion ? "FOR UPDATE" : ""}`;
        if (conexion) {
            const [filas] = await conexion.query(query, [id_profesional]);
            return filas[0] || null;
        }
        const filas = await DataBase.getInstance().ejecutarQuery(query, [id_profesional]);
        return filas[0] || null;
    }

    async cerrar(conexion, id_firma, estado, motivo, cerradaAt) {
        return conexion.query(
            `UPDATE profesional_firma SET estado = ?, cerrada_at = ?, motivo_cierre = ?
             WHERE id_firma = UUID_TO_BIN(?) AND estado = 'activa'`,
            [estado, cerradaAt, motivo, id_firma]
        );
    }

    async insertar(conexion, f) {
        return conexion.query(
            `INSERT INTO profesional_firma (
                id_firma, id_profesional, estado, origen, tinta, imagen_key, imagen_sha256, imagen_mime,
                ancho_px, alto_px, trazos_key, trazos_sha256, id_plantilla_acta, acta_sha256, acta_aceptada_at,
                id_usuario, clerk_user_id, ip, user_agent, registrada_at
            ) VALUES (UUID_TO_BIN(?), ?, 'activa', 'propia', ?, ?, ?, 'image/png', ?, ?, ?, ?, UUID_TO_BIN(?), ?, ?,
                      UUID_TO_BIN(?), ?, ?, ?, ?)`,
            [
                f.id_firma, f.id_profesional, f.tinta, f.imagen_key, f.imagen_sha256, f.ancho_px, f.alto_px,
                f.trazos_key, f.trazos_sha256, f.id_plantilla_acta, f.acta_sha256, f.acta_aceptada_at,
                f.id_usuario, f.clerk_user_id, f.ip, f.user_agent, f.registrada_at,
            ]
        );
    }
}
