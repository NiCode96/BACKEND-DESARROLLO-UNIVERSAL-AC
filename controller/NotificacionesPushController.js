import DataBase from '../config/Database.js';

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

export default class NotificacionesPushController {

    // ── Notificaciones in-app (campana del dashboard) ──────────────────────

    static async getNotificaciones(req, res) {
        try {
            // Se ocultan cuando pasa la hora de la cita (fecha_evento) o cuando el
            // usuario las descarta explícitamente (visto=1, botón "X" o "marcar
            // todas"). Ya NO se marcan leídas solo por abrir el panel.
            const rows = await db().ejecutarQuery(
                `SELECT * FROM notificaciones_inapp
                 WHERE visto = 0 AND (fecha_evento IS NULL OR fecha_evento >= NOW())
                 ORDER BY creado_en DESC LIMIT 50`,
                []
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
            await db().ejecutarQuery(`UPDATE notificaciones_inapp SET visto = 1 WHERE id = ?`, [id]);
            res.status(200).json({ message: true });
        } catch (error) {
            console.error('[NOTIF]', error.message);
            res.status(500).json({ message: 'serverError' });
        }
    }

    static async marcarTodasLeidas(req, res) {
        try {
            await db().ejecutarQuery(`UPDATE notificaciones_inapp SET visto = 1 WHERE visto = 0`, []);
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
