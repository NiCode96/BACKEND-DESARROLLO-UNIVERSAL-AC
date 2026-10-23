import {Router} from 'express';

import TelemedicinaController from "../controller/TelemedicinaController.js";
const router = Router();
// POST: crear sala tiene efectos (recurso de pago en Twilio); no debe ser GET
router.post('/nuevaSala', TelemedicinaController.nuevaSalaTelemedicina);

export default router;
