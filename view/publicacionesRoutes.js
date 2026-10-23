import { Router } from "express";
const router = Router();
import PublicacionController from "../controller/PublicacionesController.js";
import { exigirSesionClerk } from "../middleware/exigirSesionClerk.js";

// PÚBLICA: las secciones del sitio anónimo leen las publicaciones sin sesión.
router.get('/seleccionarPublicaciones', PublicacionController.seleccionarTodasPublicaciones);

// El resto del grupo exige sesión. El orden importa: solo lo declarado
// DESPUÉS de este use() pasa por el gate (incluida la captura /:id_publicaciones).
router.use(exigirSesionClerk);

router.post('/insertarPublicacion', PublicacionController.insertarPublicacion);
router.post('/actualizarPublicacion',PublicacionController.actualziarPublicaciones)
router.post('/eliminarPublicacion',PublicacionController.eliminarPublicacion );
router.get('/:id_publicaciones', PublicacionController.seleccionarPublicacionEspecifica);


export default router;