import DataBase from '../config/Database.js';
import { esAdministrador, esProfesional, esRecepcion } from '../services/firma/roles.js';

const db = () => DataBase.getInstance();

// Límites defensivos: este backend no tiene autenticación en estas rutas todavía
// (no existe login/sesión de profesional), así que se valida el shape a mano
// para no dejar entrar basura a push_subscriptions.
const ENDPOINT_MAX_LEN = 500;
const KEY_MAX_LEN = 255;

function suscripcionValida(endpoint, keys) {
    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) return false;
    if (endpoint.length > ENDPOINT_MAX_LEN) return false;
    if (typeof keys?.p256dh !== 'string' || !keys.p256dh || keys.p256dh.length > KEY_MAX_LEN) return false;
    if (typeof keys?.auth !== 'string' || !keys.auth || keys.auth.length > KEY_MAX_LEN) return false;
    return true;
}

/* Quién ve qué en la campana (reserva de la ficha, Ley 20.584):
 *  - un profesional: solo las suyas (sus citas y sus documentos por firmar);
 *  - administración, técnico y recepción (gestionan la agenda): las citas del centro y las
 *    propias, pero nunca los avisos de documentos por firmar de otro profesional;
 *  - cualquier otro rol: ninguna.
 * Antes todas las notificaciones le llegaban a todos, y "marcar todas" las borraba para todos. */
function filtroVisibles(usuario) {
    const propio = Number(usuario?.idProfesional) || -1;
    if (esAdministrador(usuario) || esRecepcion(usuario)) {
        return { sql: "(tipo <> 'documento_firma' OR id_profesional = ?)", params: [propio] };
    }
    if (esProfesional(usuario)) return { sql: "id_profesional = ?", params: [propio] };
    return { sql: "1 = 0", params: [] };
}

export default class NotificacionesPushController {

    // ── Notificaciones in-app (campana del dashboard) ──────────────────────

    static async getNotificaciones(req, res) {
        try {
            // Se ocultan cuando pasa la hora de la cita (fecha_evento) o cuando el
            // usuario las descarta explícitamente (visto=1, botón "X" o "marcar
            // todas"). Ya NO se marcan leídas solo por abrir el panel.
            const filtro = filtroVisibles(req.usuario);
            const rows = await db().ejecutarQuery(
                `SELECT * FROM notificaciones_inapp
                 WHERE visto = 0 AND (fecha_evento IS NULL OR fecha_evento >= NOW()) AND ${filtro.sql}
                 ORDER BY creado_en DESC LIMIT 50`,
                filtro.params
            );
            res.status(200).json(rows);
        } catch (error) {
            console.error('[NOTIF]', error.message);
            res.status(500).json({ message: 'serverError' });
        }
    }

    static async marcarLeida(req, res) {
        try {
            const id = Number(req.params.id);
            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({ message: 'sindata' });
            }
            const filtro = filtroVisibles(req.usuario);
            await db().ejecutarQuery(`UPDATE notificaciones_inapp SET visto = 1 WHERE id = ? AND ${filtro.sql}`, [id, ...filtro.params]);
            res.status(200).json({ message: true });
        } catch (error) {
            console.error('[NOTIF]', error.message);
            res.status(500).json({ message: 'serverError' });
        }
    }

    static async marcarTodasLeidas(req, res) {
        try {
            const filtro = filtroVisibles(req.usuario);
            await db().ejecutarQuery(`UPDATE notificaciones_inapp SET visto = 1 WHERE visto = 0 AND ${filtro.sql}`, filtro.params);
            res.status(200).json({ message: true });
        } catch (error) {
            console.error('[NOTIF]', error.message);
            res.status(500).json({ message: 'serverError' });
        }
    }

    // ── Web Push (VAPID) ────────────────────────────────────────────────────

    static async getVapidKey(req, res) {
        const key = process.env.VAPID_PUBLIC_KEY;
        if (!key) return res.status(503).json({ message: 'pushNoConfigurado' });
        res.status(200).json({ key });
    }

    static async pushSubscribe(req, res) {
        try {
            const { endpoint, keys } = req.body;
            if (!suscripcionValida(endpoint, keys)) {
                return res.status(400).json({ message: 'suscripcionInvalida' });
            }

            await db().ejecutarQuery(
                `INSERT INTO push_subscriptions (endpoint, p256dh, auth)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth = VALUES(auth)`,
                [endpoint, keys.p256dh, keys.auth]
            );
            res.status(200).json({ message: true });
        } catch (error) {
            console.error('[PUSH]', error.message);
            res.status(500).json({ message: 'serverError' });
        }
    }

    static async pushUnsubscribe(req, res) {
        try {
            const { endpoint } = req.body;
            if (typeof endpoint === 'string' && endpoint) {
                await db().ejecutarQuery(`DELETE FROM push_subscriptions WHERE endpoint = ?`, [endpoint]);
            }
            res.status(200).json({ message: true });
        } catch (error) {
            console.error('[PUSH]', error.message);
            res.status(500).json({ message: 'serverError' });
        }
    }
}
