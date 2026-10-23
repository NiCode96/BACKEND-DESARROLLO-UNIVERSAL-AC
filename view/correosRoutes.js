import { Router } from "express";
import correosAutomaticosController from "../controller/CorreosAutomaticosController.js";
import { exigirSesionClerk } from "../middleware/exigirSesionClerk.js";

const router = Router();

// PÚBLICA: formulario de contacto del sitio anónimo.
router.post("/contacto", (req, res) => correosAutomaticosController.enviarFormularioContacto(req, res));

// El resto del grupo exige sesión. El orden importa: solo lo declarado
// DESPUÉS de este use() pasa por el gate.
router.use(exigirSesionClerk);

router.post("/comprobante", (req, res) => correosAutomaticosController.enviarComprobanteCompra(req, res));
router.post("/seguimiento", (req, res) => correosAutomaticosController.enviarSeguimiento(req, res));

export default router;