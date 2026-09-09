import { Router } from 'express';
import DistribucionProfesionalController from '../controller/DistribucionProfesionalController.js';

const router = Router();

router.get('/seleccionarVigentes', DistribucionProfesionalController.seleccionarVigentes);
router.post('/actualizarDistribucion', DistribucionProfesionalController.actualizarDistribucion);

export default router;