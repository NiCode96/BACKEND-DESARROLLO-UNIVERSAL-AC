import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import ResenasController from '../controller/ResenasController.js';
import { exigirSesionClerk } from "../middleware/exigirSesionClerk.js";

const router = Router();

// Endpoint público sin autenticación: limita a 5 reseñas cada 10 minutos por IP.
const limitarInsercionResenas = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "demasiadasSolicitudes" },
});

// PÚBLICAS: el sitio anónimo muestra las reseñas y deja que un paciente deje la suya.
router.post('/insertarResena', limitarInsercionResenas, ResenasController.insertarResenaController);
router.post('/seleccionarPorProfesional', ResenasController.seleccionarPorProfesionalController);
router.post('/promedioPorProfesional', ResenasController.promedioPorProfesionalController);

// El resto del grupo exige sesión. El orden importa: solo lo declarado
// DESPUÉS de este use() pasa por el gate.
router.use(exigirSesionClerk);

router.post('/actualizarResena', ResenasController.actualizarResenaController);
router.post('/eliminarResena', ResenasController.eliminarResenaController);
router.get('/seleccionarTodas', ResenasController.seleccionarTodasLasResenas);

export default router;
