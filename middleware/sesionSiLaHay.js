import { exigirSesionClerk } from "./exigirSesionClerk.js";
import { exigirUsuarioClerk } from "./exigirUsuarioClerk.js";

/* Rutas que usan a la vez el sitio público (sin sesión) y el dashboard.
 *
 * Sin Authorization: sigue como visitante y el controlador responde solo los campos
 * públicos (ver soloCampos en services/camposPublicos.js).
 * Con Authorization: se valida igual que una ruta protegida (token y perfil). Un
 * token inválido o sin perfil da 401/403, nunca los datos completos.
 *
 * sesionSiLaHay deja req.sesionClerk; usuarioSiLoHay deja además req.usuario (rol),
 * para lo que solo puede ver un perfil (p. ej. el técnico). */
export const sesionSiLaHay = (req, res, next) =>
    (req.headers.authorization ? exigirSesionClerk(req, res, next) : next());

export const usuarioSiLoHay = (req, res, next) =>
    (req.headers.authorization ? exigirUsuarioClerk(req, res, next) : next());
