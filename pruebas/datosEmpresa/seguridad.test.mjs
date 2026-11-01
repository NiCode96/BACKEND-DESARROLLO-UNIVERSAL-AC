/*
    Seguridad del logo y de las subidas de imágenes (sin base de datos ni Clerk real).
      node --test pruebas/datosEmpresa/seguridad.test.mjs
*/
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import { esAdministradorClinica, normalizarRol } from "../../services/rolesClinica.js";
import { tipoRealImagen } from "../../services/firmaImagen.js";
import { crearExigirAdministradorClinica } from "../../middleware/exigirAdministradorClinica.js";

// ── Roles ───────────────────────────────────────────────────────────────────

test("administran: técnico, administradores y profesional con el interruptor", () => {
    for (const metadata of [
        { role: "tecnico-nativecode" },
        { role: "admin" },                       // alias antiguo del técnico
        { role: "super-usuario-nativecode" },
        { role: "admin-clinica" },
        { role: "admin-centro-salud" },
        { role: "administrador-clinico" },       // alias antiguo → admin-clinica
        { rol: "admin-clinica-odontologica" },   // clave "rol" también se acepta
        { role: "profesional-medico", administraClinica: true },
        { role: "profesional-salud", administraClinica: "true" },
        { role: "profesional-odontologo+admin" },
        { role: "  Admin-Clinica  " },
    ]) {
        assert.equal(esAdministradorClinica(metadata), true, JSON.stringify(metadata));
    }
});

test("NO administran: recepción, profesionales, suspendidos, desconocidos y vacíos", () => {
    for (const metadata of [
        { role: "recepcion" },
        { role: "secretaria" },
        { role: "profesional-medico" },
        { role: "profesional-salud", administraClinica: false },
        { role: "recepcion", administraClinica: true },   // el interruptor solo vale para profesionales
        { role: "suspendido" },
        { role: "cancelado" },
        { role: "admin-inventado" },
        { role: "" },
        {},
        null,
        undefined,
        "admin-clinica",
        { role: { $ne: null } },
        { role: ["admin-clinica"] },
        { role: "constructor" },
        { role: "__proto__" },
        { role: "toString" },
    ]) {
        assert.equal(esAdministradorClinica(metadata), false, JSON.stringify(metadata));
    }
});

test("normalizarRol", () => {
    assert.equal(normalizarRol("ADMIN"), "tecnico-nativecode");
    assert.equal(normalizarRol("profesional-medico+admin"), "profesional-medico");
    assert.equal(normalizarRol(undefined), "");
});

// ── Firma de imagen ─────────────────────────────────────────────────────────

const relleno = (n) => Buffer.alloc(n, 0);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), relleno(20)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), relleno(20)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), relleno(4), Buffer.from("WEBPVP8 "), relleno(10)]);
const GIF = Buffer.concat([Buffer.from("GIF89a"), relleno(20)]);
const AVIF = Buffer.concat([relleno(4), Buffer.from("ftypavif"), relleno(10)]);

test("reconoce imágenes reales por sus bytes", () => {
    assert.equal(tipoRealImagen(PNG), "image/png");
    assert.equal(tipoRealImagen(JPG), "image/jpeg");
    assert.equal(tipoRealImagen(WEBP), "image/webp");
    assert.equal(tipoRealImagen(GIF), "image/gif");
    assert.equal(tipoRealImagen(AVIF), "image/avif");
});

test("rechaza lo que no es imagen aunque diga serlo", () => {
    assert.equal(tipoRealImagen(Buffer.from("<svg onload=alert(1)></svg>   ")), null);
    assert.equal(tipoRealImagen(Buffer.from("%PDF-1.7 aaaaaaaaaaaa")), null);
    assert.equal(tipoRealImagen(Buffer.from("<?php system($_GET[0]); ?>")), null);
    assert.equal(tipoRealImagen(Buffer.from([0x4d, 0x5a, ...relleno(20)])), null); // ejecutable
    assert.equal(tipoRealImagen(Buffer.alloc(3)), null);
    assert.equal(tipoRealImagen("no es buffer"), null);
});

// ── Middleware de rol y ruta de subida, por HTTP ────────────────────────────

let servidor;
let base;
const consultas = [];

before(async () => {
    process.env.API_TOKEN_CLOUDFLARE = ""; // el controlador responde 500 "sinenv": prueba que pasó los filtros
    const { default: cloudflareRoutes } = await import("../../view/CloudflareRoutes.js");

    const usuarios = {
        user_admin: { role: "admin-clinica" },
        user_profesional: { role: "profesional-medico" },
        user_recepcion: { role: "recepcion" },
        user_dueno: { role: "profesional-odontologo", administraClinica: true },
    };
    const exigir = crearExigirAdministradorClinica({
        usarCache: false,
        obtenerMetadata: async (sub) => {
            consultas.push(sub);
            if (sub === "user_clerk_caido") throw new Error("Clerk no responde");
            return usuarios[sub] ?? {};
        },
    });

    const app = express();
    app.use(express.json());
    // Simula exigirSesionClerk: el sub llega por cabecera solo en la prueba
    const sesion = (req, _res, next) => {
        const sub = req.get("x-prueba-sub");
        if (sub) req.sesionClerk = { sub, ...(req.get("x-prueba-metadata") ? { metadata: JSON.parse(req.get("x-prueba-metadata")) } : {}) };
        next();
    };
    app.post("/protegido", sesion, exigir, (_req, res) => res.json({ ok: true }));
    app.use("/cloudflare", cloudflareRoutes);
    app.use((err, _req, res, _next) => res.status(500).json({ message: "error-no-controlado", detalle: err.message }));
    await new Promise((r) => { servidor = app.listen(0, "127.0.0.1", r); });
    base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => new Promise((r) => servidor.close(r)));

const pedir = (sub, extra = {}) =>
    fetch(`${base}/protegido`, { method: "POST", headers: { ...(sub ? { "x-prueba-sub": sub } : {}), ...extra } });

test("rol: sin sesión 401; administra 200; no administra 403", async () => {
    assert.equal((await pedir(null)).status, 401);
    assert.equal((await pedir("user_admin")).status, 200);
    assert.equal((await pedir("user_dueno")).status, 200);
    const r = await pedir("user_profesional");
    assert.equal(r.status, 403);
    assert.equal((await r.json()).message, "SIN-PERMISO");
    assert.equal((await pedir("user_recepcion")).status, 403);
    assert.equal((await pedir("user_desconocido")).status, 403);
});

test("rol: si Clerk no responde, falla cerrado (403)", async () => {
    assert.equal((await pedir("user_clerk_caido")).status, 403);
});

test("rol: con la plantilla de sesión se usa el rol del token, sin consultar a Clerk", async () => {
    consultas.length = 0;
    assert.equal((await pedir("user_x", { "x-prueba-metadata": JSON.stringify({ role: "admin-clinica" }) })).status, 200);
    assert.equal((await pedir("user_y", { "x-prueba-metadata": JSON.stringify({ role: "recepcion" }) })).status, 403);
    assert.deepEqual(consultas, []);
});

const subir = (buffer, tipo, nombre = "x.png") => {
    const form = new FormData();
    form.append("image", new Blob([buffer], { type: tipo }), nombre);
    return fetch(`${base}/cloudflare/subirimagenes`, { method: "POST", body: form });
};

test("subida: una imagen real pasa los filtros (llega al controlador)", async () => {
    const r = await subir(PNG, "image/png");
    assert.equal(r.status, 500);
    assert.equal((await r.json()).message, "sinenv");
});

test("subida: tipo no permitido → 415", async () => {
    const r = await subir(Buffer.from("<svg></svg>          "), "image/svg+xml", "x.svg");
    assert.equal(r.status, 415);
    assert.equal((await subir(Buffer.from("%PDF-1.7 aaaaaaaa"), "application/pdf", "x.pdf")).status, 415);
});

test("subida: mimetype falseado (dice PNG, no lo es) → 415", async () => {
    const r = await subir(Buffer.from("<?php system($_GET[0]); ?>"), "image/png", "x.png");
    assert.equal(r.status, 415);
    assert.equal((await r.json()).message, "tipo-no-permitido");
});

test("subida: más de 10 MB → 413 sin tumbar el proceso", async () => {
    const enorme = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024 + 1)]);
    const r = await subir(enorme, "image/png");
    assert.equal(r.status, 413);
    assert.equal((await r.json()).message, "imagen-muy-pesada");
    // el servidor sigue respondiendo
    assert.equal((await subir(PNG, "image/png")).status, 500);
});

// ── /pedidos: datos personales de compradores ───────────────────────────────

test("pedidos: lecturas y cambio de estado exigen sesión (401 sin token o con token falso)", async () => {
    const { default: pedidosRoutes } = await import("../../view/pedidosRoutes.js");
    const app = express();
    app.use(express.json());
    app.use("/pedidos", pedidosRoutes);
    const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    const url = `http://127.0.0.1:${srv.address().port}/pedidos`;
    try {
        const casos = [
            ["GET", "/seleccionarPedidos"],
            ["POST", "/seleccionarPorComprador"],
            ["POST", "/seleccionarPorEstados"],
            ["POST", "/seleccionarPorid"],
            ["POST", "/seleccionarDetalle"],
            ["POST", "/cambioEstado"],
        ];
        for (const [metodo, ruta] of casos) {
            for (const headers of [{}, { Authorization: "Bearer falso" }]) {
                const r = await fetch(url + ruta, {
                    method: metodo,
                    headers: { "Content-Type": "application/json", ...headers },
                    ...(metodo === "POST" ? { body: "{}" } : {}),
                });
                assert.equal(r.status, 401, `${metodo} ${ruta} ${JSON.stringify(headers)}`);
            }
        }
    } finally {
        await new Promise((r) => srv.close(r));
    }
});
