import {Router} from 'express';
import { exigirUsuarioClerk } from "../middleware/exigirUsuarioClerk.js";
import { limitePorIp, limitePorUsuario } from "../middleware/limitesTasa.js";

import TelemedicinaController from "../controller/TelemedicinaController.js";
const router = Router();

// Profesional (sesión con rol clínico; solo sobre las salas que él creó).
router.post('/nuevaSala', exigirUsuarioClerk, limitePorUsuario(10, 20), TelemedicinaController.nuevaSalaTelemedicina);
router.post('/tokenProfesional', exigirUsuarioClerk, limitePorUsuario(10, 60), TelemedicinaController.tokenProfesional);
router.post('/renovarInvitacion', exigirUsuarioClerk, limitePorUsuario(10, 30), TelemedicinaController.renovarInvitacion);
router.post('/finalizarSala', exigirUsuarioClerk, limitePorUsuario(10, 30), TelemedicinaController.finalizarSala);
// Enviar el enlace al correo de la ficha: 10 envíos cada 10 minutos por profesional.
router.post('/enviarInvitacionCorreo', exigirUsuarioClerk, limitePorUsuario(10, 10), TelemedicinaController.enviarInvitacionCorreo);

// Paciente (pública, con la invitación del enlace). Límite por IP para que no se puedan
// probar enlaces sin parar.
router.post('/tokenSala', limitePorIp(10, 30), TelemedicinaController.nuevaTokenSala);

export default router;
