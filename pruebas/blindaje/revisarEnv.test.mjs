/* scripts/revisar_env.mjs y .env.example.
 *   node --test pruebas/blindaje/revisarEnv.test.mjs */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { revisar, leerEsquema } from "../../scripts/revisar_env.mjs";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EJEMPLO = readFileSync(path.join(RAIZ, ".env.example"), "utf8");
const esquema = leerEsquema(EJEMPLO);

// Un .env completo y válido, con valores marcados para comprobar que nunca se imprimen.
const SECRETO = "VALOR-SECRETO-QUE-NO-DEBE-APARECER-0123456789";
function envValido(extra = {}) {
    const base = {
        NODE_ENV: "production", PORT: "3010", DB_HOST: "localhost", DB_USER: "app", DB_PASS: SECRETO, DB_DATABASE: "clinica",
        URL_PUBLICA_SITIO: "https://clinica.agendaclinicas.cl", FRONT_URL: "https://clinica.agendaclinicas.cl",
        BACKEND_URL: "https://back.clinica.agendaclinicas.cl", CORS_ORIGENES: "https://clinica.agendaclinicas.cl,http://localhost:3000",
        CLERK_SECRET_KEY: `sk_live_${SECRETO}`, R2_ENDPOINT: "https://cuenta.r2.cloudflarestorage.com", R2_BUCKET: "clinica",
        R2_ACCESS_KEY: SECRETO, R2_SECRET_KEY: SECRETO, ACCOUNT_ID: "a", ACCOUNT_HASH: "h", API_TOKEN_CLOUDFLARE: SECRETO,
        BREVO_API_KEY: SECRETO, CORREO_REMITENTE: "no-responder@agendaclinicas.cl", NOTIFICACION_TOKEN_SECRET: SECRETO,
        FIRMA_HMAC_CLAVE: SECRETO, ALERTA_CORREO: "ingenieria.software@nativecode.cl",
        ...extra,
    };
    return Object.entries(base).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`).join("\n");
}

test("un .env completo no tiene errores ni avisos", () => {
    assert.deepEqual(revisar(envValido(), EJEMPLO), { errores: [], avisos: [] });
});

test("detecta faltantes, formatos malos y claves repetidas", () => {
    const { errores } = revisar(envValido({ DB_PASS: undefined, BACKEND_URL: "https:back.clinica.cl", CORS_ORIGENES: "https://a.cl/", FIRMA_HMAC_CLAVE: "corta", NODE_ENV: "development" })
        + `\nCLERK_SECRET_KEY=sk_live_otra`, EJEMPLO);
    const nombres = errores.map((e) => e.split(":")[0]);
    for (const clave of ["DB_PASS", "BACKEND_URL", "CORS_ORIGENES", "FIRMA_HMAC_CLAVE", "NODE_ENV", "CLERK_SECRET_KEY"]) {
        assert.ok(nombres.includes(clave), clave);
    }
});

test("avisa claves que el código no usa", () => {
    const { errores, avisos } = revisar(envValido() + "\nMP_ACCESS_TOKEN=" + SECRETO, EJEMPLO);
    assert.deepEqual(errores, []);
    assert.ok(avisos.some((a) => a.startsWith("MP_ACCESS_TOKEN:")));
});

test("nunca muestra un valor", () => {
    const { errores, avisos } = revisar(envValido({ FIRMA_HMAC_CLAVE: "corta-pero-secreta", BACKEND_URL: SECRETO }) + "\nOTRA=" + SECRETO, EJEMPLO);
    const salida = [...errores, ...avisos].join("\n");
    assert.doesNotMatch(salida, /VALOR-SECRETO|corta-pero-secreta/);
});

test(".env.example cubre todas las variables que lee el código", () => {
    const carpetas = ["app.js", "config", "controller", "middleware", "model", "services", "view", "scripts"];
    const archivos = [];
    const recorrer = (p) => statSync(p).isDirectory() ? readdirSync(p).forEach((f) => recorrer(path.join(p, f))) : /\.(m?js)$/.test(p) && archivos.push(p);
    carpetas.forEach((c) => recorrer(path.join(RAIZ, c)));
    const usadas = new Set();
    for (const archivo of archivos) {
        const texto = readFileSync(archivo, "utf8");
        for (const m of texto.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) usadas.add(m[1]);
        for (const m of texto.matchAll(/\{([^}]+)\}\s*=\s*process\.env/g)) {
            for (const nombre of m[1].split(",")) if (/^\s*[A-Z][A-Z0-9_]+\s*$/.test(nombre)) usadas.add(nombre.trim());
        }
    }
    // API_URL se desestructura en notificacionAgendamiento.js pero no se usa.
    usadas.delete("API_URL");
    const faltan = [...usadas].filter((v) => !esquema[v]).sort();
    assert.deepEqual(faltan, [], `agregar a .env.example: ${faltan.join(", ")}`);
});
