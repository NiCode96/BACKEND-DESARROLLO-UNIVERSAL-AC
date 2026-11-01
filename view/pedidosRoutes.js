import { Router } from 'express';
import { exigirSesionClerk } from "../middleware/exigirSesionClerk.js";
const router = Router();
import PedidoComprasController from "../controller/PedidoComprasController.js";

// PÚBLICA: registrar una compra (solo inserta, no devuelve datos de otros).
router.post("/ingresarNuevoPedido", PedidoComprasController.insertarPedidoNuevo);

// El resto exige sesión: pedidoCompras guarda nombre, teléfono, correo, RUT y
// dirección de cada comprador. Antes estas rutas estaban abiertas (01-11-2026).
// Las pantallas que las usan (dashboard/pedidosCompras y pedidosDetalle) ya
// mandan el token con fetchConCarga.
router.use(exigirSesionClerk);

router.get("/seleccionarPedidos", PedidoComprasController.seleccionarPedidos);
router.post("/seleccionarPorComprador", PedidoComprasController.buscarPedidosPorNombre);
router.post("/seleccionarPorEstados", PedidoComprasController.buscarPedidosPorEstados);
router.post("/seleccionarPorid", PedidoComprasController.buscarPedidosPorID);
router.post("/seleccionarDetalle", PedidoComprasController.seleccionarDetallePedido);
router.post("/cambioEstado", PedidoComprasController.cambioEstadoDinamico);



export default router;
