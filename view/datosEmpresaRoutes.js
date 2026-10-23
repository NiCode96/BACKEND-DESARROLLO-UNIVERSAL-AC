import DatosEmpresaController from "../controller/DatosEmpresaController.js";

import {Router} from "express";
import { exigirSesionClerk } from "../middleware/exigirSesionClerk.js";
const router = Router();

// PÚBLICA: la portada, reserva-hora y el Footer del sitio anónimo leen los
// datos de la empresa (nombre, logo, horarios) sin sesión Clerk.
router.get("/seleccionartodos", DatosEmpresaController.seleccionarDatosEmpresa);

// El resto del grupo exige sesión. El orden importa: solo lo declarado
// DESPUÉS de este use() pasa por el gate.
router.use(exigirSesionClerk);

router.post("/seleccionarporid", DatosEmpresaController.seleccionarDatosEspecificos_porId);
router.post("/actualizar", DatosEmpresaController.actualizarDatos);



export default router;
