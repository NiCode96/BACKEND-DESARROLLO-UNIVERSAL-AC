import {Router} from "express";
import mercadoPagoPersistenceController from "../controller/MercadoPagoPersistenceController.js"
import { exigirSesionClerk } from "../middleware/exigirSesionClerk.js";
import { usuarioSiLoHay } from "../middleware/sesionSiLaHay.js";

const router = Router();

// PÚBLICA: el formulario público de reserva consulta si la clínica cobra con
// Mercado Pago (paciente sin sesión Clerk). Sin sesión responde solo estado_pasarela;
// el access_token sale únicamente con sesión del técnico (usuarioSiLoHay → req.usuario).
// Antes del 14-11 esta ruta devolvía la fila entera, token incluido, a cualquiera.
router.get("/obtenerPersistencia", usuarioSiLoHay, mercadoPagoPersistenceController.seleccionarMercadoPagoPersistence);

// El resto del grupo exige sesión. El orden importa: solo lo declarado
// DESPUÉS de este use() pasa por el gate.
router.use(exigirSesionClerk);

router.post("/insertarPersistencia", mercadoPagoPersistenceController.insertarPersistencia);
router.post("/actualizarEstado", mercadoPagoPersistenceController.actualizarEstado);
router.post("/actualizar", mercadoPagoPersistenceController.actualizarPersistencia);

// CERRADO (2026-10-23, hallazgo crítico del día 1): devolvía el access_token de
// MercadoPago sin autenticación. Nadie lo consume; el backend usa sus credenciales
// server-side. Ver docs/auditoria/rutas-clasificacion.md
// router.get("/obtenerTOKEN", mercadoPagoPersistenceController.seleccionarTOKEN);


export default router;
