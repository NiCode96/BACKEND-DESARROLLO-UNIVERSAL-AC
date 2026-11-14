import { verifyToken } from "@clerk/backend";
import { conTiempoLimite, resolverUsuario } from "../services/usuarioClerk.js";

/* Sesión de Clerk OBLIGATORIA (falla cerrado). Para las rutas de firma,
 * documentos y consentimientos del dashboard.
 *
 * Diferencia con verificarUsuarioClerk.js (que sigue igual para el registro de
 * accesos): aquí, sin token válido no se continúa. Si Clerk no responde, 503.
 *
 * Deja en la petición:
 *   req.usuario  = { clerkId, sesionId, fva, email, nombre, rol, idProfesional, idUsuario }
 *   req.contexto = { ip, userAgent }
 *
 * Sin un perfil de la plataforma (ver tieneAccesoPlataforma), 403.
 * Caché de 60 s por usuario (services/usuarioClerk.js). La reverificación (fva)
 * se lee siempre del token, nunca de la caché. */

export const exigirUsuarioClerk = async (req, res, next) => {
    const cabecera = req.headers.authorization || "";
    const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7).trim() : null;
    if (!token || !process.env.CLERK_SECRET_KEY) return res.status(401).json({ message: "noAutorizado" });

    let datos;
    try {
        datos = await conTiempoLimite(verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY }), "verifyToken");
    } catch (error) {
        // Clerk caído no es "sin sesión": 503 para que el front pida reintentar.
        if (error?.tiempoLimite) return res.status(503).json({ message: "serverError" });
        return res.status(401).json({ message: "noAutorizado" });
    }

    try {
        // Comprobar una vez por instancia que el token trae el claim fva (docs/firma/04 §5.2):
        // FIRMA_DEPURAR_FVA=1 en el .env. Solo imprime los dos números, nunca datos del usuario.
        if (process.env.FIRMA_DEPURAR_FVA === "1") console.log("[CLERK] fva del token:", JSON.stringify(datos.fva ?? null));
        const usuario = await resolverUsuario(datos.sub);
        if (!usuario.conAcceso) return res.status(403).json({ message: "sinPermiso" });
        req.usuario = {
            ...usuario,
            clerkId: datos.sub,
            sesionId: datos.sid || null,
            fva: Array.isArray(datos.fva) ? datos.fva : [-1, -1],
        };
        req.contexto = { ip: req.ip || null, userAgent: (req.get("user-agent") || "").slice(0, 255) };
        return next();
    } catch (error) {
        console.error("[CLERK] exigirUsuarioClerk:", error.message);
        return res.status(503).json({ message: "serverError" });
    }
};
