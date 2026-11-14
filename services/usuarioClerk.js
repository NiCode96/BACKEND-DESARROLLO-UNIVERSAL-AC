/* Quién es el usuario de una sesión de Clerk. Lo usan exigirSesionClerk.js y
 * exigirUsuarioClerk.js (un solo lugar para la caché, el tiempo límite y la
 * regla de perfiles).
 *
 * El token de sesión por defecto de Clerk no trae publicMetadata, así que el
 * perfil se consulta a Clerk por el id del usuario. Caché de 60 s por usuario:
 * suspender a alguien en Clerk le corta el acceso en un minuto como máximo. */

import { createClerkClient } from "@clerk/backend";
import UsuarioPlataforma from "../model/UsuarioPlataforma.js";
import { tieneAccesoPlataforma } from "./firma/roles.js";

let clerk = null;
function obtenerClerk() {
    if (!clerk && process.env.CLERK_SECRET_KEY) clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    return clerk;
}

// Si Clerk no responde, la petición termina con 503 en vez de quedar colgada (y ocupando memoria).
const TIEMPO_LIMITE_CLERK_MS = Number(process.env.CLERK_TIEMPO_LIMITE_MS || 8000);
export function conTiempoLimite(promesa, contexto) {
    let temporizador;
    const limite = new Promise((_, rechazar) => {
        temporizador = setTimeout(() => rechazar(Object.assign(new Error(`Clerk no respondió (${contexto})`), { tiempoLimite: true })), TIEMPO_LIMITE_CLERK_MS);
    });
    return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

const cache = new Map(); // clerkId → { usuario, vence }
const DURACION_CACHE_MS = 60_000;

/**
 * @returns {Promise<{email, nombre, rol, idProfesional, idUsuario, conAcceso: boolean}>}
 *   conAcceso = false para una cuenta sin perfil de la plataforma (vacío, desconocido,
 *   "suspendido"...). Esa cuenta NO se registra en usuario_plataforma.
 */
export async function resolverUsuario(clerkId) {
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
    usuario.conAcceso = tieneAccesoPlataforma(usuario);
    usuario.idUsuario = usuario.conAcceso
        ? await new UsuarioPlataforma().asegurar({ clerkId, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol, idProfesional: usuario.idProfesional })
        : null;
    cache.set(clerkId, { usuario, vence: Date.now() + DURACION_CACHE_MS });
    if (cache.size > 1000) cache.delete(cache.keys().next().value);
    return usuario;
}
