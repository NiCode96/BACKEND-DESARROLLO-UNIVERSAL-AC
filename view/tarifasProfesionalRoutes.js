import {Router} from 'express';
import TarifasProfesionalController from '../controller/TarifasProfesionalController.js';
import { exigirSesionClerk } from "../middleware/exigirSesionClerk.js";

const router = Router();

// PÚBLICA: la agenda y el formulario de reserva del sitio anónimo consultan
// las tarifas del profesional para armar la hora.
router.post('/seleccionarTarifasPorProfesional', TarifasProfesionalController.seleccionarTarifasPorProfesional);

// El resto del grupo exige sesión. El orden importa: solo lo declarado
// DESPUÉS de este use() pasa por el gate.
router.use(exigirSesionClerk);

router.post('/insertarTarifaProfesional', TarifasProfesionalController.insertarTarifaProfesionalController);
router.post('/seleccionarTarifaProfesional', TarifasProfesionalController.seleccionarTarifaProfesionalController);
router.post('/actualizarTarifaProfesional', TarifasProfesionalController.actualizarTarifaProfesionalController);
router.post('/eliminarTarifaProfesional', TarifasProfesionalController.eliminarTarifaProfesionalController);
router.get('/seleccionarTodasTarifasProfesionales', TarifasProfesionalController.seleccionarTodasLasTarifasProfesionales);
router.get('/seleccionarTodasTarifasConNombres', TarifasProfesionalController.seleccionarTodasLasTarifasProfesionalesConNombre);

export default router;
