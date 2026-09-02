import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import ResenasController from '../controller/ResenasController.js';

const router = Router();

// Endpoint público sin autenticación: limita a 5 reseñas cada 10 minutos por IP.
const limitarInsercionResenas = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "demasiadasSolicitudes" },
});

router.post('/insertarResena', limitarInsercionResenas, ResenasController.insertarResenaController);
router.post('/actualizarResena', ResenasController.actualizarResenaController);
router.post('/eliminarResena', ResenasController.eliminarResenaController);
router.post('/seleccionarPorProfesional', ResenasController.seleccionarPorProfesionalController);
router.post('/promedioPorProfesional', ResenasController.promedioPorProfesionalController);
router.get('/seleccionarTodas', ResenasController.seleccionarTodasLasResenas);

export default router;
