import { Router } from 'express';
import ResenasController from '../controller/ResenasController.js';

const router = Router();

router.post('/insertarResena', ResenasController.insertarResenaController);
router.post('/actualizarResena', ResenasController.actualizarResenaController);
router.post('/eliminarResena', ResenasController.eliminarResenaController);
router.post('/seleccionarPorProfesional', ResenasController.seleccionarPorProfesionalController);
router.post('/promedioPorProfesional', ResenasController.promedioPorProfesionalController);
router.get('/seleccionarTodas', ResenasController.seleccionarTodasLasResenas);

export default router;
