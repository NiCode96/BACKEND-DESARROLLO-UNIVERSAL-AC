import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/* Límites de tasa de la firma electrónica.
 *  - Por IP: rutas públicas (el paciente aún no tiene cuenta).
 *  - Por usuario de Clerk: rutas del dashboard (toda la clínica comparte una IP,
 *    así que limitar por IP bloquearía a todo el equipo). Va DESPUÉS de exigirUsuarioClerk. */

const comun = { standardHeaders: true, legacyHeaders: false, message: { message: "demasiadasSolicitudes" } };

export const limitePorIp = (minutos, maximo) =>
    rateLimit({ ...comun, windowMs: minutos * 60 * 1000, limit: maximo });

export const limitePorUsuario = (minutos, maximo) =>
    rateLimit({
        ...comun,
        windowMs: minutos * 60 * 1000,
        limit: maximo,
        keyGenerator: (req) => req.usuario?.clerkId || ipKeyGenerator(req.ip || ""),
    });
