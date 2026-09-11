import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import NotificacionesPushController from '../controller/NotificacionesPushController.js';

const router = Router();

// Endpoint público sin autenticación (no hay login de profesional todavía):
// limita a 10 suscripciones cada 10 minutos por IP para evitar llenar push_subscriptions de basura.
const limitarPushSubscribe = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'demasiadasSolicitudes' },
});

const numericId = (req, res, next, val) =>
    /^\d+$/.test(val) ? next() : res.status(400).json({ message: 'idInvalido' });
router.param('id', numericId);

router.get('/pendientes', NotificacionesPushController.getNotificaciones);
router.post('/:id/leer', NotificacionesPushController.marcarLeida);
router.post('/leer-todas', NotificacionesPushController.marcarTodasLeidas);

router.get('/vapid-key', NotificacionesPushController.getVapidKey);
router.post('/push-subscribe', limitarPushSubscribe, NotificacionesPushController.pushSubscribe);
router.delete('/push-unsubscribe', NotificacionesPushController.pushUnsubscribe);

export default router;
