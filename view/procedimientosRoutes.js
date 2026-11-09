import { Router } from "express";
import ProcedimientosController from "../controller/ProcedimientosController.js";
import { exigirUsuarioClerk } from "../middleware/exigirUsuarioClerk.js";
import { limitePorUsuario } from "../middleware/limitesTasa.js";

/* Procedimientos del consentimiento informado (docs/firma/02 §7.8).
 * Consultar: administradores y profesionales. Crear, versionar y retirar: administradores. */

const router = Router();
router.use(exigirUsuarioClerk);

router.post("/listar", ProcedimientosController.listar);
router.post("/historial", ProcedimientosController.historial);
router.post("/crear", limitePorUsuario(10, 20), ProcedimientosController.crear);
router.post("/nuevaVersion", limitePorUsuario(10, 30), ProcedimientosController.nuevaVersion);
router.post("/retirar", limitePorUsuario(10, 20), ProcedimientosController.retirar);

export default router;
