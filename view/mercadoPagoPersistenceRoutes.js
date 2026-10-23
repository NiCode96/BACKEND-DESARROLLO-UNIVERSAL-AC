import {Router} from "express";
import mercadoPagoPersistenceController from "../controller/MercadoPagoPersistenceController.js"
import { exigirSesionClerk } from "../middleware/exigirSesionClerk.js";

const router = Router();

// PÚBLICA: el formulario público de reserva consulta el estado del pago
// mientras MercadoPago redirige de vuelta (paciente sin sesión Clerk).
router.get("/obtenerPersistencia", mercadoPagoPersistenceController.seleccionarMercadoPagoPersistence);

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
