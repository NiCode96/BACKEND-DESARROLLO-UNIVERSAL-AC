import {Router} from 'express';
import ProfesionalesController from '../controller/ProfesionalesController.js';
import { exigirSesionClerk } from "../middleware/exigirSesionClerk.js";

const router = Router();

// PÚBLICAS: la agenda y el formulario de reserva del sitio anónimo leen los
// profesionales sin sesión Clerk.
router.post('/seleccionarProfesional', ProfesionalesController.seleccionarProfesionalController);
router.get('/seleccionarTodosProfesionales', ProfesionalesController.seleccionarTodosLosProfesionales);

// El resto del grupo exige sesión. El orden importa: solo lo declarado
// DESPUÉS de este use() pasa por el gate.
router.use(exigirSesionClerk);

router.post('/insertarProfesional', ProfesionalesController.insertarProfesionalController);
router.post('/actualizarProfesional', ProfesionalesController.actualizarProfesionalController);
router.post('/eliminarProfesional', ProfesionalesController.eliminarProfesionalController);

export default router;





