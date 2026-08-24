import { Router } from "express";
import DetalleCotizacionController from "../controller/DetalleCotizacionController.js"

const router = Router();

router.post("/insertarDetalle", DetalleCotizacionController.insertarNuevoDetalle);
router.post("/eliminarDetalle", DetalleCotizacionController.eliminarDetalleCotizacion);
router.post("/actualizarDetalle", DetalleCotizacionController.actualizarDetalleCotizacion);
router.post("/seleccionarPorIdCotizacion", DetalleCotizacionController.seleccionarPorIdCotizacion);

export default router;
