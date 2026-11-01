import { createClerkClient } from "@clerk/backend";
import { esAdministradorClinica } from "../services/rolesClinica.js";

/*
    Exige que quien llama ADMINISTRE la clínica (administrador, profesional con
    "También administra la clínica" o técnico NativeCode). Va DESPUÉS de
    exigirSesionClerk, que deja la sesión verificada en req.sesionClerk.

    El rol vive en publicMetadata del usuario. Si la instancia tiene la
    plantilla de sesión {"metadata": "{{user.public_metadata}}"} viene en el
    token; si no, se consulta a Clerk por el id (una llamada, cacheada 60 s).

    Falla CERRADO: sin sesión → 401; sin rol que administre, o si no se pudo
    saber el rol (Clerk caído, sin secret key) → 403. Nunca deja pasar por duda.
*/

const DURACION_CACHE_MS = 60_000;
const MAX_CACHE = 500;
const cache = new Map(); // sub → { metadata, vence }

let clerk = null;
async function metadataDesdeClerk(sub) {
    if (!process.env.CLERK_SECRET_KEY) throw new Error("sin CLERK_SECRET_KEY");
    if (!clerk) clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const usuario = await clerk.users.getUser(sub);
    return usuario?.publicMetadata ?? {};
}

async function metadataConCache(sub, obtenerMetadata) {
    const ahora = Date.now();
    const guardado = cache.get(sub);
    if (guardado && guardado.vence > ahora) return guardado.metadata;

    const metadata = await obtenerMetadata(sub);
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
    cache.set(sub, { metadata, vence: ahora + DURACION_CACHE_MS });
    return metadata;
}

/* Fábrica para poder probarlo sin Clerk real: obtenerMetadata(sub) → publicMetadata */
export function crearExigirAdministradorClinica({ obtenerMetadata = metadataDesdeClerk, usarCache = true } = {}) {
    return async function exigirAdministradorClinica(req, res, next) {
        const sesion = req.sesionClerk;
        if (!sesion?.sub) return res.status(401).json({ message: "USUARIO-SIN-AUTENTICACION" });

        try {
            const enToken = sesion.metadata && typeof sesion.metadata === "object" ? sesion.metadata : null;
            const metadata = enToken ?? (usarCache
                ? await metadataConCache(sesion.sub, obtenerMetadata)
                : await obtenerMetadata(sesion.sub));

            if (!esAdministradorClinica(metadata)) {
                console.warn(`[AUTORIZACION] rechazado (no administra la clínica) · ${req.method} ${req.baseUrl}${req.path} · usuario=${sesion.sub}`);
                return res.status(403).json({ message: "SIN-PERMISO" });
            }
            return next();
        } catch (error) {
            console.error(`[AUTORIZACION] no se pudo verificar el rol · usuario=${sesion.sub}:`, error?.message ?? error);
            return res.status(403).json({ message: "SIN-PERMISO" });
        }
    };
}

export const exigirAdministradorClinica = crearExigirAdministradorClinica();
