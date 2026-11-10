import {Router} from "express";
import FichaClinicaController from "../controller/FichaClinicaController.js";
import { exigirUsuarioClerk } from "../middleware/exigirUsuarioClerk.js";

const router = Router();
// Quién es el usuario (rol y agenda): las fichas se filtran por autor en el controlador.
router.use(exigirUsuarioClerk);

router.get("/seleccionarTodasLasFichas", FichaClinicaController.seleccionarTodasFichas);
router.post("/seleccionarFichaID", FichaClinicaController.seleccionarFichaID);
router.post("/seleccionarFichasPaciente", FichaClinicaController.seleccionarFichasPaciente);
router.post("/editarFichaPaciente", FichaClinicaController.editarFichaPaciente);
router.post("/insertarFichaClinica", FichaClinicaController.insertarNuevaFichaPaciente);
router.post("/eliminarFichaClinica", FichaClinicaController.eliminarFicha);
router.post("/seleccionarFichaEspecificaPorId", FichaClinicaController.seleccionarFichaPacientePorIDdeFicha);
router.post("/seleccionar_similitud_nombre_profesional", FichaClinicaController.seleccionar_similitud_nombre_profesional);


export default router;
