import { Router } from "express";
import CotizacionPacienteController from '../controller/CotizacionPacientesController.js';
const router = Router();
router.post("/insertarCotizacion", CotizacionPacienteController.insertarCotizacion);
router.post("/actualizarCotizacion", CotizacionPacienteController.actualizarCotizacion);
router.post("/seleccionarCotizacionEspecifica", CotizacionPacienteController.seleccionarCotizacionEspecifica);
router.post("/seleccionar_cotizaciones_paciente_especifico_por_id", CotizacionPacienteController.seleccionar_cotizaciones_paciente_especifico_por_id);
router.post("/seleccionar_cotizaciones_paciente_porEstado", CotizacionPacienteController.seleccionar_cotizaciones_paciente_porEstado);
router.post("/seleccionar_cotizaciones_paciente_profesional", CotizacionPacienteController.seleccionar_cotizaciones_paciente_profesional);
router.post("/eliminarCotizacion", CotizacionPacienteController.eliminarCotizacion);
router.post("/seleccionar_cotizaciones_paciente", CotizacionPacienteController.seleccionar_cotizaciones_paciente);
router.post("/actualizarTotal", CotizacionPacienteController.actualizarTotal);
router.post("/actualizarEstado", CotizacionPacienteController.actualizarEstado);
router.post("/actualizarObservacion", CotizacionPacienteController.actualizarObservacion);

export default router;