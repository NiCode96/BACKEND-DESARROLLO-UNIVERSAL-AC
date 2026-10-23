import { Router } from "express";
const router = Router();
import ProductoController from "../controller/ProductoController.js";
import { exigirSesionClerk } from "../middleware/exigirSesionClerk.js";

// PÚBLICA: la ficha pública del producto (sitio del paciente) la consulta
// sin sesión Clerk.
router.post('/seleccionarPorSubSubcategoria', ProductoController.seleccionarProductoSubSubcategoria);

// El resto del grupo exige sesión. El orden importa: solo lo declarado
// DESPUÉS de este use() pasa por el gate (incluida la captura /:id_producto).
router.use(exigirSesionClerk);

router.post('/buscarSimilar', ProductoController.seleccionarProductoSimilar);
router.post('/seleccionarProductoEspecifico_id', ProductoController.seleccionarProductoEspecifico_id);

router.post('/insertarProducto', ProductoController.insertarProducto);
router.post('/seleccionarPorSubcategoria', ProductoController.seleccionarProductoSubcategoria);
router.post('/actualizarProducto', ProductoController.actualizarProducto);
router.post('/actualizarStock', ProductoController.actualizarStock);
router.post('/eliminarProducto', ProductoController.eliminarProducto);
router.post('/marcarOferta', ProductoController.marcarProductoComoOferta);
router.post('/marcarNormal', ProductoController.marcarProductoNormal);
router.get('/seleccionarProducto', ProductoController.seleccionarTodosProductos);
router.get('/seleccionarProductoReciente', ProductoController.seleccionarProductosRecientes);
router.get('/seleccionarOfertas', ProductoController.seleccionarTodosProductosOferta);
router.post('/categoriaProducto', ProductoController.seleccionarProductoCategoria);
router.get('/ordenarMayor', ProductoController.seleccionarTodosProductosMayorPrecio);
router.get('/ordenarMenor', ProductoController.seleccionarTodosProductosMenorPrecio);
router.get('/:id_producto', ProductoController.seleccionarProductoEspecifico);







export default router;