/*
    Fases 5 y 6 de docs/firma de punta a punta: reverificación de Clerk (claim fva) y
    firma (grafía) del profesional: acta de adhesión, registro, normalización con sharp,
    reemplazo, descarga con control de huella, revocación e interruptor de emergencia.

    HTTP → router y controlador reales → MySQL → sharp. Clerk y R2 se SIMULAN.

    Requiere una base de PRUEBA con el dump, las migraciones de docs/firma y las de migraciones/:
      DB_HOST=127.0.0.1 DB_PORT=3407 DB_USER=prueba DB_PASS=prueba DB_DATABASE=ac_firma \
        node --experimental-test-module-mocks --test pruebas/firma/firmaProfesional.e2e.mjs
*/
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, mock, test } from "node:test";
import express from "express";
import sharp from "sharp";

if (!process.env.DB_DATABASE || /produccion/i.test(process.env.DB_DATABASE)) {
    console.error("Configura DB_* con una base de PRUEBA."); process.exit(1);
}
process.env.FIRMA_HMAC_CLAVE ||= "clave-de-prueba-solo-para-tests-0123456789abcdef";
process.env.FIRMA_HMAC_VERSION ||= "1";

const ID_PROFESIONAL = 46;  // activo en el dump
const ID_OTRO = 45;  // existe en el dump (la FK de usuario_plataforma lo exige)
// Usuarios simulados (cabecera X-Prueba-Usuario); fva por cabecera X-Prueba-Fva ("primer,segundo")
const USUARIOS = {
    duenio: { clerkId: "user_firma_duenio", rol: "profesional-medico", nombre: "Dueña Firma", idProfesional: ID_PROFESIONAL },
    // Mismo profesional, otro usuario de Clerk: el límite de 5 registros por hora es por usuario,
    // así cada grupo de casos tiene su propio contador.
    duenioActa: { clerkId: "user_firma_acta", rol: "profesional-medico", nombre: "Dueña Acta", idProfesional: ID_PROFESIONAL },
    duenioDatos: { clerkId: "user_firma_datos", rol: "profesional-medico", nombre: "Dueña Datos", idProfesional: ID_PROFESIONAL },
    duenioLimite: { clerkId: "user_firma_limite", rol: "profesional-medico", nombre: "Dueña Límite", idProfesional: ID_PROFESIONAL },
    otro: { clerkId: "user_firma_otro", rol: "profesional-medico", nombre: "Otro Firma", idProfesional: ID_OTRO },
    admin: { clerkId: "user_firma_admin", rol: "admin-clinica", nombre: "Admin Firma", idProfesional: null },
};
mock.module("../../middleware/exigirUsuarioClerk.js", {
    namedExports: {
        exigirUsuarioClerk: (req, res, next) => {
            const u = USUARIOS[req.get("x-prueba-usuario")];
            if (!u) return res.status(401).json({ message: "noAutorizado" });
            const fva = (req.get("x-prueba-fva") || "1,-1").split(",").map(Number);
            req.usuario = { ...u, sesionId: "sess_prueba", fva };
            req.contexto = { ip: "127.0.0.1", userAgent: "Prueba/1.0" };
            return next();
        },
    },
});
const r2 = new Map();
mock.module("../../services/r2Storage.js", {
    namedExports: {
        construirKey: (id, n) => `pacientes/${id}/${n}`,
        construirKeyPrivada: (carpeta, ext) => `${carpeta}/prueba-${r2.size + 1}.${ext}`,
        subirArchivo: async (buffer, key) => { r2.set(key, Buffer.from(buffer)); },
        eliminarArchivoR2: async (key) => { r2.delete(key); },
        generarUrlDescarga: async (key) => `https://r2.prueba/${key}`,
        descargarArchivoComoBuffer: async (key) => r2.get(key),
        listarClaves: async () => ({ claves: [] }),
    },
});

const { default: rutas } = await import("../../view/firmaProfesionalRoutes.js");
const { default: Profesionales } = await import("../../model/Profesionales.js");
const { default: DataBase } = await import("../../config/Database.js");
const db = DataBase.getInstance();
const sha256 = (b) => createHash("sha256").update(b).digest("hex");

let servidor, base, acta;
const logOriginal = console.error;
const errores = [];

// Firma de prueba: un trazo azul sobre fondo transparente, más grande que el máximo (600×200)
const pngFirma = (color = "#1d4ed8") => sharp({ create: { width: 900, height: 360, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: Buffer.from(`<svg width="900" height="360"><path d="M60 250 C 200 40, 380 330, 520 120 S 780 260, 840 90" stroke="${color}" stroke-width="10" fill="none"/></svg>`) }])
    .png().toBuffer();
const pngVacio = () => sharp({ create: { width: 400, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
const jpeg = () => sharp({ create: { width: 400, height: 200, channels: 3, background: "#ffffff" } }).jpeg().toBuffer();
const trazos = (n = 40) => [Array.from({ length: n }, (_, i) => ({ x: 10 + i * 5, y: 50 + (i % 7) * 3, t: i * 16 }))];

before(async () => {
    console.error = (...a) => errores.push(a.join(" "));
    for (const u of Object.values(USUARIOS)) {
        const [{ id }] = await db.ejecutarQuery("SELECT UUID() AS id");
        u.idUsuario = id;
        await db.ejecutarQuery(
            "INSERT INTO usuario_plataforma (id_usuario, clerk_user_id, id_profesional, nombre, rol) VALUES (UUID_TO_BIN(?), ?, ?, ?, ?)",
            [id, u.clerkId, u.idProfesional, u.nombre, u.rol]);
    }
    const app = express();
    app.use(express.json());
    app.use("/firmaProfesional", rutas);
    await new Promise((r) => { servidor = app.listen(0, "127.0.0.1", r); });
    base = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
    console.error = logOriginal;
    delete process.env.FIRMA_HABILITADA;
    if (servidor) await new Promise((r) => servidor.close(r));
    await db.cerrarConexion();
    DataBase.instance = null;
});

const post = async (ruta, cuerpo, usuario, fva) => {
    const headers = { "Content-Type": "application/json", ...(usuario ? { "X-Prueba-Usuario": usuario } : {}), ...(fva ? { "X-Prueba-Fva": fva } : {}) };
    const r = await fetch(base + ruta, { method: "POST", headers, body: JSON.stringify(cuerpo) });
    const tipo = r.headers.get("content-type") || "";
    return { status: r.status, tipo, cuerpo: tipo.includes("json") ? await r.json() : Buffer.from(await r.arrayBuffer()) };
};
async function registrar({ usuario = "duenio", fva = "2,-1", imagen, campos = {} } = {}) {
    const fd = new FormData();
    const datos = { id_profesional: ID_PROFESIONAL, tinta: "azul", trazos: JSON.stringify(trazos()), acta_version: acta.version, acta_aceptada: "true", ...campos };
    for (const [k, v] of Object.entries(datos)) fd.append(k, String(v));
    fd.append("imagen", new Blob([imagen ?? await pngFirma()], { type: "image/png" }), "firma.png");
    const r = await fetch(`${base}/firmaProfesional/registrarFirma`, { method: "POST", headers: { "X-Prueba-Usuario": usuario, "X-Prueba-Fva": fva }, body: fd });
    return { status: r.status, cuerpo: await r.json().catch(() => null) };
}
const eventos = async (tipo) => (await db.ejecutarQuery(
    "SELECT COUNT(*) n FROM firma_evento WHERE id_profesional = ? AND tipo_evento = ?", [ID_PROFESIONAL, tipo]))[0].n;
const firmas = () => db.ejecutarQuery("SELECT estado FROM profesional_firma WHERE id_profesional = ? ORDER BY registrada_at", [ID_PROFESIONAL]);

test("sin sesión: todas las rutas responden 401", async () => {
    for (const r of ["seleccionarEstadoFirma", "seleccionarActaVigente", "registrarFirma", "seleccionarImagenFirma", "revocarFirma"]) {
        assert.equal((await post(`/firmaProfesional/${r}`, {})).status, 401, r);
    }
});

test("acta vigente: versión, texto y huella", async () => {
    const r = await post("/firmaProfesional/seleccionarActaVigente", {}, "duenio");
    assert.equal(r.status, 200);
    acta = r.cuerpo.acta;
    assert.match(acta.version, /^\d+\.0$/);
    assert.ok(acta.cuerpo.length > 200);
    assert.equal(acta.sha256, sha256(acta.cuerpo));
});

test("estado: el dueño y el administrador lo ven; otro profesional no", async () => {
    assert.equal((await post("/firmaProfesional/seleccionarEstadoFirma", { id_profesional: ID_PROFESIONAL }, "otro")).status, 403);
    for (const u of ["duenio", "admin"]) {
        const r = await post("/firmaProfesional/seleccionarEstadoFirma", { id_profesional: ID_PROFESIONAL }, u);
        assert.equal(r.status, 200, u);
        assert.equal(r.cuerpo.firma, null);
        assert.ok(r.cuerpo.registroSis);
    }
});

test("reverificación: sin verificar en los últimos 10 minutos responde la señal de Clerk", async () => {
    for (const fva of ["30,-1", "-1,-1", "11,45"]) {
        const r = await registrar({ fva });
        assert.equal(r.status, 403, fva);
        assert.equal(r.cuerpo.message, "reverificacionRequerida");
        assert.equal(r.cuerpo.clerk_error.reason, "reverification-error", "useReverification del front la reconoce");
    }
    assert.equal((await firmas()).length, 0, "nada se guardó");
});

test("nadie firma por otro: ni un administrador ni otro profesional, aun reverificados", async () => {
    for (const u of ["admin", "otro"]) assert.deepEqual((await registrar({ usuario: u })).cuerpo, { message: "sinPermiso" }, u);
});

test("acta: sin aceptar o con versión antigua se rechaza", async () => {
    assert.deepEqual((await registrar({ usuario: "duenioActa", campos: { acta_aceptada: "false" } })).cuerpo, { message: "actaNoAceptada" });
    assert.deepEqual((await registrar({ usuario: "duenioActa", campos: { acta_version: "0.9" } })).cuerpo, { message: "actaDesactualizada" });
});

test("datos inválidos: tinta, trazos cortos, JPEG disfrazado y PNG vacío", async () => {
    const usuario = "duenioDatos";
    assert.equal((await registrar({ usuario, campos: { tinta: "roja" } })).status, 400);
    assert.equal((await registrar({ usuario, campos: { trazos: JSON.stringify(trazos(5)) } })).status, 400);
    assert.deepEqual((await registrar({ usuario, imagen: await jpeg() })).cuerpo, { message: "pngInvalido" });
    assert.deepEqual((await registrar({ usuario, imagen: await pngVacio() })).cuerpo, { message: "pngInvalido" });
    assert.equal((await firmas()).length, 0);
});

test("límite: más de 5 intentos de registro en una hora por usuario → 429", async () => {
    for (let i = 0; i < 5; i++) assert.equal((await registrar({ usuario: "duenioLimite", campos: { tinta: "roja" } })).status, 400);
    assert.deepEqual((await registrar({ usuario: "duenioLimite" })).cuerpo, { message: "demasiadasSolicitudes" });
});

test("registrar: normaliza a máx. 600×200, guarda en R2 con huella y deja acta y firma en la evidencia", async () => {
    const r = await registrar();
    assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.firma.estado, "activa");
    const [fila] = await db.ejecutarQuery("SELECT * FROM profesional_firma WHERE id_profesional = ? AND estado = 'activa'", [ID_PROFESIONAL]);
    assert.ok(fila.ancho_px <= 600 && fila.alto_px <= 200 && (fila.ancho_px === 600 || fila.alto_px === 200), `${fila.ancho_px}×${fila.alto_px}`);
    const guardada = r2.get(fila.imagen_key);
    assert.ok(guardada, "la imagen normalizada está en R2");
    assert.equal(sha256(guardada), fila.imagen_sha256);
    assert.equal((await sharp(guardada).metadata()).format, "png");
    assert.equal(fila.acta_sha256, acta.sha256);
    assert.equal(await eventos("acta_aceptada"), 1);
    assert.equal(await eventos("firma_registrada"), 1);
});

test("con el segundo factor reciente también se acepta (fva 30,4)", async () => {
    assert.equal((await registrar({ fva: "30,4", imagen: await pngFirma("#111111"), campos: { tinta: "negro" } })).status, 200);
});

test("reemplazo: una sola activa; la anterior queda 'reemplazada' con su evento", async () => {
    assert.deepEqual((await firmas()).map((f) => f.estado), ["reemplazada", "activa"]);
    assert.equal(await eventos("firma_reemplazada"), 1);
    const [p] = await new Profesionales().seleccionarProfesionalPorID(ID_PROFESIONAL);
    assert.equal(p.firma_estado, "activa", "el listado lo refleja");
});

test("imagen de la firma: solo el dueño, y llega idéntica a su huella", async () => {
    assert.equal((await post("/firmaProfesional/seleccionarImagenFirma", { id_profesional: ID_PROFESIONAL }, "admin")).status, 403);
    const r = await post("/firmaProfesional/seleccionarImagenFirma", { id_profesional: ID_PROFESIONAL }, "duenio");
    assert.equal(r.status, 200);
    const [fila] = await db.ejecutarQuery("SELECT imagen_sha256 FROM profesional_firma WHERE id_profesional = ? AND estado = 'activa'", [ID_PROFESIONAL]);
    assert.equal(sha256(r.cuerpo), fila.imagen_sha256);
});

test("imagen alterada en R2: no se entrega", async () => {
    const [fila] = await db.ejecutarQuery("SELECT imagen_key FROM profesional_firma WHERE id_profesional = ? AND estado = 'activa'", [ID_PROFESIONAL]);
    const original = r2.get(fila.imagen_key);
    r2.set(fila.imagen_key, Buffer.concat([original, Buffer.from("x")]));
    assert.equal((await post("/firmaProfesional/seleccionarImagenFirma", { id_profesional: ID_PROFESIONAL }, "duenio")).status, 500);
    r2.set(fila.imagen_key, original);
});

test("interruptor de emergencia: FIRMA_HABILITADA=0 apaga el registro (503) sin tocar lo demás", async () => {
    process.env.FIRMA_HABILITADA = "0";
    assert.deepEqual((await registrar()).cuerpo, { message: "servicioOcupado" });
    assert.equal((await post("/firmaProfesional/seleccionarEstadoFirma", { id_profesional: ID_PROFESIONAL }, "duenio")).status, 200);
    delete process.env.FIRMA_HABILITADA;
});

test("revocar: pide reverificación; luego queda sin firma activa y con su evento", async () => {
    assert.equal((await post("/firmaProfesional/revocarFirma", { id_profesional: ID_PROFESIONAL }, "duenio", "45,-1")).status, 403);
    assert.equal((await post("/firmaProfesional/revocarFirma", { id_profesional: ID_PROFESIONAL }, "otro", "1,-1")).status, 403);
    const r = await post("/firmaProfesional/revocarFirma", { id_profesional: ID_PROFESIONAL, motivo: "Prueba" }, "duenio", "1,-1");
    assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
    assert.deepEqual((await firmas()).map((f) => f.estado), ["reemplazada", "revocada"]);
    assert.equal(await eventos("firma_revocada"), 1);
    const [p] = await new Profesionales().seleccionarProfesionalPorID(ID_PROFESIONAL);
    assert.equal(p.firma_estado, "ninguna");
    assert.equal((await post("/firmaProfesional/revocarFirma", { id_profesional: ID_PROFESIONAL }, "duenio", "1,-1")).cuerpo.message, "firmaInexistente");
});

test("ningún error inesperado en el log", () => {
    // El caso de la imagen alterada en R2 escribe su alerta a propósito.
    assert.deepEqual(errores.filter((e) => !/ExperimentalWarning|\[CLERK\]|huella|sha|integridad/i.test(e)), []);
});
