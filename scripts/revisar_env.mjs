/* Revisa el .env de esta instancia contra .env.example SIN mostrar ningún valor.
 *
 *   node scripts/revisar_env.mjs              → revisa ./.env
 *   node scripts/revisar_env.mjs ruta/al/.env
 *
 * .env.example es la lista oficial: cada variable trae [obligatoria]/[opcional] y
 * [secreto]/[instancia]/[fija]. Para sumar una variable nueva basta agregarla allí.
 *
 * ERROR (sale con código 1): obligatoria vacía, formato inválido, clave repetida.
 * AVISO: opcional con formato dudoso, o una clave del .env que el código no usa.
 * Solo imprime NOMBRES de variables, nunca su contenido. */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Lee un .env como lista de { clave, valor } en orden, conservando repetidas. */
export function leerEnv(texto) {
    const filas = [];
    for (const linea of texto.split(/\r?\n/)) {
        const m = linea.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!m) continue;
        let valor = m[2].trim();
        const comilla = valor[0];
        if ((comilla === '"' || comilla === "'") && valor.endsWith(comilla) && valor.length > 1) valor = valor.slice(1, -1);
        else valor = valor.replace(/\s+#.*$/, "");
        filas.push({ clave: m[1], valor });
    }
    return filas;
}

/** Lee .env.example: { CLAVE: { obligatoria, tipo } } según las marcas del comentario anterior. */
export function leerEsquema(texto) {
    const esquema = {};
    let marcas = "";
    for (const linea of texto.split(/\r?\n/)) {
        if (/^\s*#/.test(linea)) { if (/\[(obligatoria|opcional)\]/.test(linea)) marcas = linea; continue; }
        const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
        if (!m) { marcas = ""; continue; }
        esquema[m[1]] = {
            obligatoria: marcas.includes("[obligatoria]"),
            tipo: (marcas.match(/\[(secreto|instancia|fija)\]/) || [])[1] || "fija",
        };
        marcas = "";
    }
    return esquema;
}

// Se exige el texto literal "https://": new URL("https:dominio") lo corrige solo y lo
// aceptaría, pero un parser estricto falla (pasó con NEXT_PUBLIC_API_URL).
const esUrl = (v, { local = false } = {}) => {
    if (!/^https?:\/\/[^/]/.test(v)) return false;
    try {
        const u = new URL(v);
        if (u.protocol === "https:") return true;
        return local && u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname);
    } catch { return false; }
};
const esOrigen = (v) => esUrl(v, { local: true }) && new URL(v).pathname === "/" && !/\/$/.test(v) && !new URL(v).search;
const esCorreo = (v) => /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(v);
const esNumero = (v) => /^\d+$/.test(v);

/** Regla de formato por nombre. Devuelve el problema (texto) o null. */
function problemaDeFormato(clave, valor) {
    if (["URL_PUBLICA_SITIO", "FRONT_URL", "BACKEND_URL", "R2_ENDPOINT", "TEST_RESERVA_BASE_URL"].includes(clave)) {
        return esUrl(valor) ? null : "debe ser una URL https:// completa (con las dos barras)";
    }
    if (clave === "CORS_ORIGENES") {
        const lista = valor.split(",").map((o) => o.trim()).filter(Boolean);
        if (!lista.length) return "lista vacía";
        return lista.every(esOrigen) ? null : "cada origen: https://dominio (o http://localhost:puerto), sin ruta ni barra final";
    }
    if (clave === "ALERTA_CORREO") return valor.split(",").every((c) => esCorreo(c.trim())) ? null : "correos separados por coma";
    if (clave === "CORREO_REMITENTE") return esCorreo(valor) ? null : "debe ser un correo";
    if (["FIRMA_HMAC_CLAVE", "NOTIFICACION_TOKEN_SECRET"].includes(clave)) return valor.length >= 32 ? null : "muy corta: mínimo 32 caracteres";
    if (clave === "FIRMA_HMAC_CLAVES_ANTERIORES") { try { JSON.parse(valor); return null; } catch { return "debe ser JSON, p. ej. {\"1\":\"…\"}"; } }
    if (clave === "NODE_ENV") return valor === "production" ? null : "en el servidor debe ser production";
    if (clave === "FIRMA_HABILITADA") return ["0", "1"].includes(valor) ? null : "debe ser 0 o 1";
    if (clave === "CLERK_SECRET_KEY") return /^sk_(live|test)_/.test(valor) ? null : "debe empezar con sk_live_ (o sk_test_ en local)";
    if (/(^PORT$|_PORT$|_LIMIT$|_MS$|_DIAS$|_HORAS$|_MIN$|^FIRMA_CONCURRENCIA$|^FIRMA_HMAC_VERSION$)/.test(clave)) {
        return esNumero(valor) ? null : "debe ser un número entero";
    }
    return null;
}

/** Revisa y devuelve { errores, avisos } con mensajes que solo nombran variables. */
export function revisar(textoEnv, textoEjemplo) {
    const filas = leerEnv(textoEnv);
    const esquema = leerEsquema(textoEjemplo);
    const errores = [];
    const avisos = [];

    const vistas = new Map();
    for (const { clave } of filas) vistas.set(clave, (vistas.get(clave) || 0) + 1);
    for (const [clave, veces] of vistas) {
        if (veces > 1) errores.push(`${clave}: aparece ${veces} veces (dejar una sola; no se sabe cuál usa la app)`);
    }
    const valores = Object.fromEntries(filas.map(({ clave, valor }) => [clave, valor]));

    for (const [clave, { obligatoria }] of Object.entries(esquema)) {
        const valor = valores[clave] ?? "";
        if (!valor) {
            if (obligatoria) errores.push(`${clave}: falta (obligatoria)`);
            continue;
        }
        const problema = problemaDeFormato(clave, valor);
        if (problema) (obligatoria ? errores : avisos).push(`${clave}: ${problema}`);
    }
    for (const clave of vistas.keys()) {
        if (!esquema[clave]) avisos.push(`${clave}: el código no la usa (si es un secreto viejo, quitarla)`);
    }
    return { errores, avisos };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const rutaEnv = path.resolve(process.argv[2] || path.join(RAIZ, ".env"));
    let textoEnv;
    try {
        textoEnv = readFileSync(rutaEnv, "utf8");
    } catch {
        console.error(`No se pudo leer ${rutaEnv}`);
        process.exit(1);
    }
    const { errores, avisos } = revisar(textoEnv, readFileSync(path.join(RAIZ, ".env.example"), "utf8"));
    for (const e of errores) console.log(`✗ ${e}`);
    for (const a of avisos) console.log(`! ${a}`);
    console.log(errores.length ? `${errores.length} error(es), ${avisos.length} aviso(s).` : `Sin errores (${avisos.length} aviso(s)).`);
    process.exit(errores.length ? 1 : 0);
}
