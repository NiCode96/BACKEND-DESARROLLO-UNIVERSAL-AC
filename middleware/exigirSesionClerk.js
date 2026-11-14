import { verifyToken } from "@clerk/backend";
import { conTiempoLimite, resolverUsuario } from "../services/usuarioClerk.js";

/* Sesión de Clerk con un perfil de la plataforma.
 *
 * Un token válido NO basta: en Clerk cualquiera puede crearse una cuenta si el
 * registro de la instancia queda en "Public", y esa cuenta tendría un token
 * válido sin perfil. Por eso, además del token, el usuario debe tener un perfil
 * con dashboard (técnico, administración, profesional o recepción); si no, 403.
 *
 * El perfil se lee de Clerk con la caché de 60 s de services/usuarioClerk.js:
 * suspender a alguien en Clerk le corta el acceso en un minuto como máximo. */
export const exigirSesionClerk = async (req, res, next) => {
    const cabecera = req.headers.authorization || '';
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : null;

    if (!token) {
        return res.status(401).json({ message: "USUARIO-SIN-AUTENTICACION" });
    }

    try {
        // Se conserva la sesión verificada para que los controladores puedan
        // registrar en la bitácora quién hizo cada cambio (req.sesionClerk.sub).
        req.sesionClerk = await conTiempoLimite(verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY }), "verifyToken");
    } catch (error) {
        if (error?.tiempoLimite) return res.status(503).json({ message: "serverError" });
        return res.status(401).json({ message: "USUARIO-SIN-AUTENTICACION" });
    }

    try {
        const usuario = await resolverUsuario(req.sesionClerk.sub);
        if (!usuario.conAcceso) return res.status(403).json({ message: "sinPermiso" });
        return next();
    } catch (error) {
        // Clerk no respondió: no se sabe el perfil, así que no se deja pasar.
        console.error("[CLERK] exigirSesionClerk:", error.message);
        return res.status(503).json({ message: "serverError" });
    }
};
