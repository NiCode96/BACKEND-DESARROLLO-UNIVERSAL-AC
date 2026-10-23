import { Router } from 'express';
import { verificarApiKey } from '../middleware/verificarApiKey.js';
import { verificarUsuarioClerk } from '../middleware/verificarUsuarioClerk.js';
import { exigirSesionClerk } from '../middleware/exigirSesionClerk.js';
import HealthMetricsController from '../controller/HealthMetricsController.js';

const router = Router();

// Lo llama el cron diario de NativeCode Finance. Protegido con API key.
router.get('/', verificarApiKey, HealthMetricsController.obtenerMetricas);

// Lo llama el navegador del profesional al entrar al dashboard.
// NO lleva API key (esa es de Finance): el gate exige sesión Clerk (el front
// manda el Bearer) y verificarUsuarioClerk enriquece quién es para el registro.
router.post('/acceso', exigirSesionClerk, verificarUsuarioClerk, HealthMetricsController.registrarAcceso);

export default router;