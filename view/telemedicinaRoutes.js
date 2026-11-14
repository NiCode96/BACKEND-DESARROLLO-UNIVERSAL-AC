import {Router} from 'express';
import { exigirSesionClerk } from "../middleware/exigirSesionClerk.js";
import { exigirUsuarioClerk } from "../middleware/exigirUsuarioClerk.js";
import { limitePorUsuario } from "../middleware/limitesTasa.js";

import TelemedicinaController from "../controller/TelemedicinaController.js";
const router = Router();
router.post('/nuevaSala', exigirSesionClerk, TelemedicinaController.nuevaSalaTelemedicina);
router.post('/tokenSala', TelemedicinaController.nuevaTokenSala);
// Enviar el enlace al correo de la ficha: 10 envíos cada 10 minutos por profesional.
router.post('/enviarInvitacionCorreo', exigirUsuarioClerk, limitePorUsuario(10, 10), TelemedicinaController.enviarInvitacionCorreo);

export default router;
