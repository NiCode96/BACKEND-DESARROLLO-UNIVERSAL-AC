import { Router } from "express";
const router = Router();
import CarruselPortadaController from "../controller/CarruselPortadaController.js"
import { exigirSesionClerk } from "../middleware/exigirSesionClerk.js";

// PÚBLICA: la portada del sitio anónimo muestra el carrusel sin sesión.
router.get('/seleccionarCarruselPortada', CarruselPortadaController.seleccionarPortadasController);

// El resto del grupo exige sesión. El orden importa: solo lo declarado
// DESPUÉS de este use() pasa por el gate.
router.use(exigirSesionClerk);

router.post('/insertarCarruselPortada', CarruselPortadaController.insertarPortadaController);
router.post('/actualizarCarruselPortada', CarruselPortadaController.editarPortadaController);
router.post('/eliminarCarruselPortada', CarruselPortadaController.eliminarPortadaController);
router.post('/seleccionarCarruselPortadaporId', CarruselPortadaController.seleccionarPortadaEspecificaIdController);




export default router;