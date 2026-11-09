import {Router} from 'express';
import ProfesionalesController from '../controller/ProfesionalesController.js';
import { exigirSesionClerk } from "../middleware/exigirSesionClerk.js";
// FIRMA: registro de la Superintendencia de Salud y sesión de Clerk.
import RegistroSisController from '../controller/RegistroSisController.js';
import { verificarUsuarioClerk } from '../middleware/verificarUsuarioClerk.js';
import { exigirUsuarioClerk } from '../middleware/exigirUsuarioClerk.js';
import { subirCertificado, manejarErrorArchivo } from '../middleware/limitesArchivos.js';

// Basado en la versión protegida de main (commit "PROTECCION DE SEGURIDAD
// CRITICA", 2026-10-23). Se conserva su gate y solo se agregan las rutas de firma.

const router = Router();

// PÚBLICAS: la agenda y el formulario de reserva del sitio anónimo leen los
// profesionales sin sesión Clerk.
router.post('/seleccionarProfesional', ProfesionalesController.seleccionarProfesionalController);
router.get('/seleccionarTodosProfesionales', ProfesionalesController.seleccionarTodosLosProfesionales);

// El resto del grupo exige sesión. El orden importa: solo lo declarado
// DESPUÉS de este use() pasa por el gate.
router.use(exigirSesionClerk);

// verificarUsuarioClerk deja en req.usuario quién creó o editó el profesional
// (evidencia del N° de registro). El gate de arriba ya garantiza el token.
router.post('/insertarProfesional', verificarUsuarioClerk, ProfesionalesController.insertarProfesionalController);
router.post('/actualizarProfesional', verificarUsuarioClerk, ProfesionalesController.actualizarProfesionalController);
router.post('/eliminarProfesional', ProfesionalesController.eliminarProfesionalController);

// FIRMA: registro Superintendencia de Salud (sesión obligatoria)
router.post('/actualizarRegistroSis', exigirUsuarioClerk, subirCertificado.single('certificado'), manejarErrorArchivo, RegistroSisController.actualizarRegistroSis);
router.post('/verificarRegistroSis', exigirUsuarioClerk, RegistroSisController.verificarRegistroSis);
router.post('/descargarCertificadoSis', exigirUsuarioClerk, RegistroSisController.descargarCertificadoSis);

export default router;
