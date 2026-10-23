import { Router } from "express";
const router = Router();
import PublicacionesTituloDescripcionController from "../controller/PublicacionesTituloDescripcionController.js";
import { exigirSesionClerk } from "../middleware/exigirSesionClerk.js";

// PÚBLICA: la sección 2 del sitio anónimo lee estas publicaciones sin sesión.
router.get('/seleccionarPublicacionesTituloDetalle', PublicacionesTituloDescripcionController.seleccionarPublicacionesTituloDescripcionController);

// El resto del grupo exige sesión. El orden importa: solo lo declarado
// DESPUÉS de este use() pasa por el gate.
router.use(exigirSesionClerk);

router.post('/insertarPublicacionesTituloDetalle', PublicacionesTituloDescripcionController.insertarPublicacionesTituloDescripcionController);
router.post('/actualizarPublicacionesTituloDetalle', PublicacionesTituloDescripcionController.actualizarPublicacionesTituloDescripcionController);
router.post('/eliminarPublicacionesTituloDetalle', PublicacionesTituloDescripcionController.eliminarPublicacionesTituloDescripcionController);
router.post('/seleccionarEspecificoPublicacionesTituloDetalle', PublicacionesTituloDescripcionController.seleccionarEspecifica_PublicacionesTituloDescripcionController);


export default router;