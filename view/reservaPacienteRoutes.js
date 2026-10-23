import {Router} from 'express';
import ReservaPacienteController from "../controller/ReservaPacienteController.js";
import { exigirSesionClerk } from "../middleware/exigirSesionClerk.js";

const router = Router();

// ── PÚBLICAS: flujo de agendamiento del paciente anónimo (sin sesión Clerk) ──
// Excepciones del grupo según docs/auditoria/rutas-clasificacion.md
router.post("/validar", ReservaPacienteController.validacionDisponibilidad);
router.post("/insertarReservaPacienteFicha", ReservaPacienteController.insertarReservaPaciente); // INSERTAR PACIENTE SIN FICHA PARA CAMBIARA MODO FICHA DEBE CAMBIARSE EL METODO

// ── Todo lo demás exige sesión de Clerk ──
// El orden importa: solo lo declarado DESPUÉS de este use() pasa por el gate.
// Una ruta agregada arriba de esta línea quedaría pública sin querer.
router.use(exigirSesionClerk);

// Rutas para gestión de reservas existentes
router.get("/seleccionarReservados", ReservaPacienteController.seleccionarReservados);
router.post("/seleccionarSegunEstado", ReservaPacienteController.seleccionarSegunEstado);
router.post("/actualizarEstado", ReservaPacienteController.actualizarEstado);
router.post("/seleccionarNombre", ReservaPacienteController.buscarSimilitudNombre);
router.post("/seleccionarRut", ReservaPacienteController.buscarSimilitudRut);
router.post("/buscarEntreFechas", ReservaPacienteController.buscarEntreFechas);
router.post("/eliminarReserva", ReservaPacienteController.eliminarReserva);
router.post("/seleccionarEspecifica", ReservaPacienteController.seleccionarReservaEspecifica);
router.post("/actualizarReservacion", ReservaPacienteController.actualizarInformacionReserva);
router.post("/seleccionarPorProfesional", ReservaPacienteController.seleccionarReservaSegunId_Profesional);
router.post("/insertarReservasMultiples", ReservaPacienteController.insertarReservasMultiples); // INSERTAR PACIENTE SIN FICHA PARA CAMBIARA MODO FICHA DEBE CAMBIARSE EL METODO
router.post("/insertar", ReservaPacienteController.insertarReservaPaciente);




export default router;
