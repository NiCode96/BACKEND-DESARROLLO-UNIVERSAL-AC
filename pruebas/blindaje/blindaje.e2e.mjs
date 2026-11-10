/*
    Blindaje del backend: errores sin filtrar información, Clerk con tiempo límite y
    un proceso que no se cae por una promesa rechazada.

    Requiere una base de PRUEBA (la de cualquier otra prueba sirve):
      DB_HOST=127.0.0.1 DB_PORT=3407 DB_USER=prueba DB_PASS=prueba DB_DATABASE=ac_docs \
        node --experimental-test-module-mocks --test pruebas/blindaje/blindaje.e2e.mjs
*/
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { after, before, mock, test } from "node:test";
import express from "express";

if (!process.env.DB_DATABASE || /produccion/i.test(process.env.DB_DATABASE)) {
    console.error("Configura DB_* con una base de PRUEBA."); process.exit(1);
}
const RAIZ = fileURLToPath(new URL("../../", import.meta.url));
const PUERTO = 4700 + Math.floor(Math.random() * 200);
let proceso, salida = "";

before(async () => {
    // app.js real, como en el servidor (sin NODE_ENV=production).
    proceso = spawn(process.execPath, ["app.js"], {
        cwd: RAIZ, env: { ...process.env, PORT: String(PUERTO), NODE_ENV: "", CLERK_SECRET_KEY: "sk_test_falsa" }, stdio: ["ignore", "pipe", "pipe"],
    });
    proceso.stdout.on("data", (d) => { salida += d; });
    proceso.stderr.on("data", (d) => { salida += d; });
    for (let i = 0; i < 100 && !salida.includes("CORRIENDO"); i++) await new Promise((r) => setTimeout(r, 100));
    assert.match(salida, /CORRIENDO/, "app.js arrancó");
});
after(() => proceso?.kill());

const url = (r) => `http://127.0.0.1:${PUERTO}${r}`;

test("JSON mal formado: 400 en JSON, sin traza ni rutas del servidor", async () => {
    const r = await fetch(url("/procedimientos/listar"), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{malformado" });
    assert.equal(r.status, 400);
    assert.match(r.headers.get("content-type"), /application\/json/);
    const texto = await r.text();
    assert.deepEqual(JSON.parse(texto), { message: "datoinvalido" });
    assert.doesNotMatch(texto, /node_modules|\/root\/|at JSON\.parse/);
});

test("cuerpo demasiado grande: 413 en JSON", async () => {
    const r = await fetch(url("/procedimientos/listar"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ x: "a".repeat(200_000) }) });
    assert.equal(r.status, 413);
    assert.deepEqual(await r.json(), { message: "archivoDemasiadoGrande" });
});

test("no anuncia X-Powered-By", async () => {
    const r = await fetch(url("/consentimientos/seleccionarVigentes"));
    assert.equal(r.headers.get("x-powered-by"), null);
});

test("el proceso sigue vivo después de los errores", async () => {
    assert.equal(proceso.exitCode, null);
    const r = await fetch(url("/consentimientos/seleccionarVigentes"));
    assert.equal(r.status, 200);
});

test("Clerk colgado: exigirUsuarioClerk responde 503 a tiempo (no queda esperando)", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_falsa";
    process.env.CLERK_TIEMPO_LIMITE_MS = "300";
    mock.module("@clerk/backend", {
        namedExports: { verifyToken: () => new Promise(() => {}), createClerkClient: () => ({ users: { getUser: () => new Promise(() => {}) } }) },
    });
    const { exigirUsuarioClerk } = await import("../../middleware/exigirUsuarioClerk.js");
    const app = express();
    app.get("/x", exigirUsuarioClerk, (req, res) => res.json({ ok: true }));
    const servidor = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    const inicio = Date.now();
    const r = await fetch(`http://127.0.0.1:${servidor.address().port}/x`, { headers: { Authorization: "Bearer token" } });
    const demora = Date.now() - inicio;
    servidor.close();
    assert.equal(r.status, 503);
    assert.ok(demora < 2000, `respondió en ${demora} ms`);
});
