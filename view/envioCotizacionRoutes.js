import { Router } from "express";
import EnvioCotizacionController from "../controller/EnvioCotizacionesController.js"

const router = Router();

router.post("/enviarCotizacion", EnvioCotizacionController.enviarCotizacionPorCorreo);

export default router;
