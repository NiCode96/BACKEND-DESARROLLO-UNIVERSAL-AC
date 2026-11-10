import { Router } from "express";
import FirmaProfesionalController from "../controller/FirmaProfesionalController.js";
import { exigirUsuarioClerk } from "../middleware/exigirUsuarioClerk.js";
import { exigirReverificacion } from "../middleware/exigirReverificacion.js";
import { firmaHabilitada } from "../middleware/firmaHabilitada.js";
import { subirImagenFirma, manejarErrorArchivo } from "../middleware/limitesArchivos.js";
import { limitePorUsuario } from "../middleware/limitesTasa.js";

/* Firma del profesional (docs/firma/02 §4). Todas exigen sesión de Clerk. */

const router = Router();

// 5 registros de firma por hora por usuario.
const limiteRegistro = limitePorUsuario(60, 5);

router.use(exigirUsuarioClerk);

router.post("/seleccionarEstadoFirma", FirmaProfesionalController.seleccionarEstadoFirma);
router.post("/seleccionarActaVigente", FirmaProfesionalController.seleccionarActaVigente);
router.post("/registrarFirma", firmaHabilitada, exigirReverificacion(), limiteRegistro,
    subirImagenFirma.single("imagen"), manejarErrorArchivo, FirmaProfesionalController.registrarFirma);
router.post("/seleccionarImagenFirma", FirmaProfesionalController.seleccionarImagenFirma);
router.post("/revocarFirma", exigirReverificacion(), FirmaProfesionalController.revocarFirma);

export default router;
