import { Router } from 'express';
import { verificarApiKey } from '../middleware/verificarApiKey.js';
import { verificarUsuarioClerk } from '../middleware/verificarUsuarioClerk.js';
import HealthMetricsController from '../controller/HealthMetricsController.js';

const router = Router();

// Lo llama el cron diario de NativeCode Finance. Protegido con API key.
router.get('/', verificarApiKey, HealthMetricsController.obtenerMetricas);

// Lo llama el navegador del profesional al entrar al dashboard.
// NO lleva API key (esa es de Finance); lleva el token de Clerk para saber quién es.
router.post('/acceso', verificarUsuarioClerk, HealthMetricsController.registrarAcceso);

export default router;