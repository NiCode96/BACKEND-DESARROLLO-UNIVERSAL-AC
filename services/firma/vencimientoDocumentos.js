/* Vencimiento de los documentos por firmar (bandeja), decidido con el centro el 10-11-2026:
 *  - A los FIRMA_AVISO_DIAS (7) se avisa al profesional firmante en la campana del dashboard
 *    (una vez por documento; el aviso no nombra pacientes ni datos clínicos).
 *  - A los FIRMA_VENCE_DIAS (30) el documento se anula solo; el consentimiento informado, a
 *    las FIRMA_VENCE_CONSENTIMIENTO_HORAS (24), porque el código del paciente ya caducó.
 *    Queda el evento documento_anulado con actor "sistema" y se borra el borrador de R2
 *    (nunca se firmó; su huella sigue en la base).
 *
 * Lo corre un temporizador en app.js. Procesa en tandas acotadas y no se superpone consigo
 * mismo: un atraso se recupera en las vueltas siguientes. */

import DataBase from "../../config/Database.js";
import DocumentoEmitido from "../../model/DocumentoEmitido.js";
import { registrarEvento } from "./cadenaEvidencia.js";
import { ahoraUtc, aMysqlUtc } from "./tiempo.js";
import { eliminarArchivoR2 } from "../r2Storage.js";

const numero = (valor, porDefecto) => (Number(valor) > 0 ? Number(valor) : porDefecto);
export const plazos = () => ({
    avisoDias: numero(process.env.FIRMA_AVISO_DIAS, 7),
    venceDias: numero(process.env.FIRMA_VENCE_DIAS, 30),
    venceConsentimientoHoras: numero(process.env.FIRMA_VENCE_CONSENTIMIENTO_HORAS, 24),
});
const TANDA = 100;
const hace = (ms) => aMysqlUtc(new Date(ahoraUtc().getTime() - ms));
const HORA = 3_600_000;

/** Instante en que vence un documento pendiente (para mostrarlo en la bandeja). */
export function venceEl(documento) {
    const p = plazos();
    const preparado = new Date(documento.preparado_at).getTime();
    const ms = documento.tipo_documento === "consentimiento_informado" ? p.venceConsentimientoHoras * HORA : p.venceDias * 24 * HORA;
    return new Date(preparado + ms).toISOString();
}

/** Anula un pendiente y deja su evento. `actor` = usuario que lo quita, o null para el sistema. */
export async function anularPendiente({ id_documento, motivo, actor = null, contexto = {} }) {
    const conexion = await DataBase.getInstance().obtenerConexion();
    let borrador = null;
    try {
        await conexion.beginTransaction();
        const modelo = new DocumentoEmitido();
        const documento = await modelo.seleccionarPorId(id_documento, conexion);
        if (!documento || documento.estado !== "pendiente_firma") {
            await conexion.rollback();
            return false;
        }
        const ahora = ahoraUtc();
        await modelo.anular(conexion, documento.id_documento, actor?.idUsuario ?? null, motivo, aMysqlUtc(ahora));
        await registrarEvento(conexion, {
            tipo_evento: "documento_anulado", id_documento: documento.id_documento,
            id_profesional: documento.id_profesional_firmante, id_paciente: documento.id_paciente,
            actor_tipo: actor ? (actor.esFirmante ? "profesional" : "operador") : "sistema",
            actor_usuario: actor?.idUsuario ?? null, actor_clerk_id: actor?.clerkId ?? null, actor_nombre: actor?.nombre ?? "Sistema",
            metodo_autenticacion: actor ? "clerk_sesion" : "sistema", autenticado_at: actor ? ahora : null,
            documento_sha256: documento.borrador_sha256, ip: contexto.ip ?? null, user_agent: contexto.userAgent ?? null,
            datos: { motivo, estado_anterior: "pendiente_firma", codigo: documento.codigo_verificacion, borrador_eliminado: true },
        });
        await conexion.commit();
        borrador = documento.borrador_key;
    } catch (error) {
        await conexion.rollback().catch(() => {});
        throw error;
    } finally {
        conexion.release();
    }
    // Después del commit: si R2 falla, el documento igual quedó anulado (el archivo huérfano
    // no tiene valor y no se entrega a nadie).
    if (borrador) await eliminarArchivoR2(borrador).catch((e) => console.error("[FIRMA] borrar borrador vencido:", e.message));
    return true;
}

let corriendo = false;

export async function revisarVencimientos() {
    if (corriendo) return { omitido: true };
    corriendo = true;
    const resultado = { vencidos: 0, avisos: 0 };
    try {
        const db = DataBase.getInstance();
        const p = plazos();

        // 1. Vencer (antes de avisar: no se avisa por lo que ya venció).
        const vencidos = await db.ejecutarQuery(
            `SELECT BIN_TO_UUID(id_documento) AS id_documento, tipo_documento FROM documento_emitido
             WHERE estado = 'pendiente_firma'
               AND ((tipo_documento = 'consentimiento_informado' AND preparado_at < ?)
                 OR (tipo_documento <> 'consentimiento_informado' AND preparado_at < ?))
             ORDER BY preparado_at LIMIT ${TANDA}`,
            [hace(p.venceConsentimientoHoras * HORA), hace(p.venceDias * 24 * HORA)]
        );
        for (const d of vencidos) {
            const motivo = d.tipo_documento === "consentimiento_informado"
                ? `Vencido sin firmar (${p.venceConsentimientoHoras} h)` : `Vencido sin firmar (${p.venceDias} días)`;
            if (await anularPendiente({ id_documento: d.id_documento, motivo }).catch((e) => console.error("[FIRMA] vencer:", e.message))) resultado.vencidos++;
        }

        // 2. Avisar una vez por documento, agrupado por profesional.
        const porAvisar = await db.ejecutarQuery(
            `SELECT BIN_TO_UUID(id_documento) AS id_documento, id_profesional_firmante FROM documento_emitido
             WHERE estado = 'pendiente_firma' AND aviso_vencimiento_at IS NULL
               AND tipo_documento <> 'consentimiento_informado' AND preparado_at < ?
             ORDER BY preparado_at LIMIT ${TANDA}`,
            [hace(p.avisoDias * 24 * HORA)]
        );
        const grupos = new Map();
        for (const d of porAvisar) grupos.set(d.id_profesional_firmante, [...(grupos.get(d.id_profesional_firmante) || []), d.id_documento]);
        for (const [id_profesional, ids] of grupos) {
            const n = ids.length;
            await db.ejecutarQuery(
                `INSERT INTO notificaciones_inapp (id_profesional, titulo, descripcion, tipo) VALUES (?, ?, ?, 'documento_firma')`,
                [id_profesional, n === 1 ? "Tienes un documento esperando tu firma" : `Tienes ${n} documentos esperando tu firma`,
                    `Lleva más de ${p.avisoDias} días en Documentos por firmar. Si no se firma, vence a los ${p.venceDias} días.`]
            );
            await db.ejecutarQuery(
                `UPDATE documento_emitido SET aviso_vencimiento_at = ? WHERE id_documento IN (${ids.map(() => "UUID_TO_BIN(?)").join(",")})`,
                [aMysqlUtc(ahoraUtc()), ...ids]
            );
            resultado.avisos += n;
        }
        if (resultado.vencidos || resultado.avisos) console.log(`[FIRMA] vencimientos: ${resultado.vencidos} anulados, ${resultado.avisos} avisados`);
        return resultado;
    } finally {
        corriendo = false;
    }
}
