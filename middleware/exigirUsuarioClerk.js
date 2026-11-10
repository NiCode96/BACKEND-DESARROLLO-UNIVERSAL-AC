import { verifyToken, createClerkClient } from "@clerk/backend";
import UsuarioPlataforma from "../model/UsuarioPlataforma.js";

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
 * Caché de 60 s por usuario para no consultar a Clerk en cada petición. La
 * reverificación (fva) se lee siempre del token, nunca de la caché. */

let clerk = null;
function obtenerClerk() {
    if (!clerk && process.env.CLERK_SECRET_KEY) clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    return clerk;
}

// Si Clerk no responde, la petición termina con 503 en vez de quedar colgada (y ocupando memoria).
const TIEMPO_LIMITE_CLERK_MS = Number(process.env.CLERK_TIEMPO_LIMITE_MS || 8000);
function conTiempoLimite(promesa, contexto) {
    let temporizador;
    const limite = new Promise((_, rechazar) => {
        temporizador = setTimeout(() => rechazar(Object.assign(new Error(`Clerk no respondió (${contexto})`), { tiempoLimite: true })), TIEMPO_LIMITE_CLERK_MS);
    });
    return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

const cache = new Map(); // clerkId → { usuario, vence }
const DURACION_CACHE_MS = 60_000;

async function resolverUsuario(clerkId) {
    const guardado = cache.get(clerkId);
    if (guardado && guardado.vence > Date.now()) return guardado.usuario;

    const u = await conTiempoLimite(obtenerClerk().users.getUser(clerkId), "getUser");
    const meta = u.publicMetadata || {};
    const usuario = {
        email: u.primaryEmailAddress?.emailAddress || u.emailAddresses?.[0]?.emailAddress || null,
        nombre: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.username || null,
        rol: meta.role || meta.rol || null,
        idProfesional: Number(meta.idProfesionalAgenda) || null,
    };
    usuario.idUsuario = await new UsuarioPlataforma().asegurar({ clerkId, ...usuario });
    cache.set(clerkId, { usuario, vence: Date.now() + DURACION_CACHE_MS });
    if (cache.size > 1000) cache.delete(cache.keys().next().value);
    return usuario;
}

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
