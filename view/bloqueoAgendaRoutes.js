import { Router } from "express";
const router = Router();
import BloqueoAgendaController from "../controller/BloqueoAgendaController.js";
import { exigirSesionClerk } from "../middleware/exigirSesionClerk.js";
import { sesionSiLaHay } from "../middleware/sesionSiLaHay.js";

// PÚBLICA: la agenda pública consulta los bloqueos del profesional para
// ofrecer solo los horarios disponibles (sin sesión, sin el motivo; ver sesionSiLaHay).
router.post('/seleccionarBloqueosPorProfesional', sesionSiLaHay, BloqueoAgendaController.seleccionarBloqueosPorProfesional);

// El resto del grupo exige sesión. El orden importa: solo lo declarado
// DESPUÉS de este use() pasa por el gate.
router.use(exigirSesionClerk);

router.post('/InsertarBloqueo', BloqueoAgendaController.InsertarBloqueoController);
router.post('/eliminarBloqueo', BloqueoAgendaController.eliminarBloqueoController);
router.post('/seleccionarBloqueosEntreFechas', BloqueoAgendaController.seleccionarBloqueosEntreFechasController);
router.get('/seleccionarTodos', BloqueoAgendaController.seleccionarTodosLosBloqueosController);




export default router;