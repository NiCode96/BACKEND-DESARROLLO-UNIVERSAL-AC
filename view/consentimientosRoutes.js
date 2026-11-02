import { Router } from "express";
import { limitePorIp } from "../middleware/limitesTasa.js";
import ConsentimientosController from "../controller/ConsentimientosController.js";
import { exigirUsuarioClerk } from "../middleware/exigirUsuarioClerk.js";

/* Consentimientos de la reserva pública (docs/firma/02 §7).
 * Las dos primeras rutas son PÚBLICAS (el paciente aún no tiene cuenta) y por eso
 * llevan límite de tasa por IP. Las demás son del dashboard y exigen sesión de Clerk. */

const router = Router();

const limite = (minutos, maximo) => limitePorIp(minutos, maximo);

// Públicas
router.get("/seleccionarVigentes", limite(10, 60), ConsentimientosController.seleccionarVigentes);
router.post("/registrarAceptacion", limite(10, 10), ConsentimientosController.registrarAceptacion);

// Dashboard (sesión de Clerk obligatoria)
router.post("/listarPorPaciente", exigirUsuarioClerk, ConsentimientosController.listarPorPaciente);
router.post("/descargarAceptacion", exigirUsuarioClerk, ConsentimientosController.descargarAceptacion);
router.post("/enviarAceptacionCorreo", exigirUsuarioClerk, ConsentimientosController.enviarAceptacionCorreo);
router.post("/revocarAceptacion", exigirUsuarioClerk, ConsentimientosController.revocarAceptacion);

export default router;
