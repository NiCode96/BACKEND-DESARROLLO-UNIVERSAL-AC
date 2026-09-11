import webpush from 'web-push';
import DataBase from '../config/Database.js';

const db = () => DataBase.getInstance();

// Este bloque corre al importar el módulo (arranque del servidor, antes de app.listen).
// web-push valida el formato de las llaves y LANZA si son inválidas — sin este try/catch,
// una VAPID key mal pegada en el .env tumbaría el proceso completo al iniciar.
let vapidConfigurado = false;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    try {
        webpush.setVapidDetails(
            'mailto:' + (process.env.CORREO_REMITENTE || 'contacto@agendaclinica.cl'),
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
        vapidConfigurado = true;
    } catch (error) {
        console.error('[PUSH] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY inválidas, push deshabilitado:', error.message);
    }
}

// Envío global: todas las suscripciones activas reciben el aviso.
// No se filtra por profesional todavía porque el backend no tiene login/sesión de
// profesional real (queda pendiente para cuando se integre con Clerk).
export async function sendPushToAll(titulo, body, url = '/dashboard') {
    if (!vapidConfigurado) return;

    try {
        const subs = await db().ejecutarQuery(`SELECT * FROM push_subscriptions`, []);
        if (!subs?.length) return;

        const payload = JSON.stringify({ titulo, body, icon: '/logoAC3.png', url });
        await Promise.allSettled(
            subs.map(sub =>
                webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    payload
                ).catch(async (err) => {
                    // 410/404 = suscripción caducada (navegador desinstalado, permisos revocados, etc.)
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await db().ejecutarQuery(`DELETE FROM push_subscriptions WHERE id = ?`, [sub.id]);
                    }
                })
            )
        );
    } catch (e) {
        console.error('[PUSH] Error enviando notificación:', e.message);
    }
}
