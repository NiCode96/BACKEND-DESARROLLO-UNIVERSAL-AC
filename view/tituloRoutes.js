import {Router} from "express";
import TituloController from "../controller/TituloController.js";
import { exigirSesionClerk } from "../middleware/exigirSesionClerk.js";
const router = Router();

// PÚBLICA: la portada del sitio anónimo lee los títulos principales.
router.get("/", TituloController.mostrarTitulo)

// El resto del grupo exige sesión. El orden importa: solo lo declarado
// DESPUÉS de este use() pasa por el gate.
router.use(exigirSesionClerk);

router.put('/', TituloController.editarTituloPrincipal)
router.put('/subtitulo', TituloController.editarSubtitulo)
router.put('/sobrenosotros', TituloController.cambiarSobreNosotros)
router.put('/proyectos', TituloController.cambiarTituloProyectos)
router.put('/contacto', TituloController.cambiarTituloContacto)




export default router;