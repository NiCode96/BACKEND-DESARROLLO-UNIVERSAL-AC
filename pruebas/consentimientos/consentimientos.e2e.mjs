/*
    Consentimiento de la reserva pública (política de privacidad, Ley 21.719) de punta a punta:
    HTTP → router y controlador reales → MySQL (tablas de docs/firma) → cadena de evidencia.

    R2 y el correo se SIMULAN (no hay credenciales en la prueba): se verifica que lo que se
    subiría sea un PDF real. Todo lo demás corre de verdad.

    Requiere una base de PRUEBA con el dump y las migraciones 2026-10-23_firma_electronica(.sql|_seed.sql):
      DB_HOST=127.0.0.1 DB_PORT=3407 DB_USER=prueba DB_PASS=prueba DB_DATABASE=ac_consent \
        node --experimental-test-module-mocks --test pruebas/consentimientos/consentimientos.e2e.mjs
*/
import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";
import express from "express";

if (!process.env.DB_DATABASE || /produccion/i.test(process.env.DB_DATABASE)) {
    console.error("Configura DB_* con una base de PRUEBA."); process.exit(1);
}
process.env.FIRMA_HMAC_CLAVE ||= "clave-de-prueba-solo-para-tests-0123456789abcdef";
process.env.FIRMA_HMAC_VERSION ||= "1";
process.env.URL_PUBLICA_SITIO ||= "https://desarrollo.agendaclinicas.cl";
process.env.CLERK_SECRET_KEY ||= "sk_test_falsa";

const subidas = [];
const correos = [];
mock.module("../../services/r2Storage.js", {
    namedExports: {
        construirKey: (id, n) => `pacientes/${id}/${n}`,
        construirKeyPrivada: (carpeta, ext) => `${carpeta}/prueba-${subidas.length + 1}.${ext}`,
        subirArchivo: async (buffer, key, tipo) => { subidas.push({ buffer, key, tipo }); },
        eliminarArchivoR2: async () => {},
        generarUrlDescarga: async (key) => `https://r2.prueba/${key}?firma=x`,
        descargarArchivoComoBuffer: async () => Buffer.from("%PDF-1.4 prueba"),
        listarClaves: async () => ({ claves: [] }),
    },
});
const correoReal = await import("../../services/firma/correoFirma.js");
mock.module("../../services/firma/correoFirma.js", {
    namedExports: { ...correoReal, enviarCorreo: async (args) => { correos.push(args); return { ok: true }; } },
});

const { default: rutas } = await import("../../view/consentimientosRoutes.js");
const { default: rutasVerificacion } = await import("../../view/verificacionRoutes.js");
const { vincularAceptacionConReserva } = await import("../../controller/ConsentimientosController.js");
const { default: DataBase } = await import("../../config/Database.js");
const db = DataBase.getInstance();

const RUT_PACIENTE = "191695879";   // id_paciente 2283 en el dump
const ID_PROFESIONAL = 46;
let servidor, base, plantillas, tokenValido, codigoValido;
const logOriginal = console.error;
const errores = [];

before(async () => {
    console.error = (...a) => errores.push(a.join(" "));
    const app = express();
    app.set("trust proxy", 1);      // igual que app.js
    app.use(express.json());
    app.use("/consentimientos", rutas);
    app.use("/verificacion", rutasVerificacion);
    await new Promise((r) => { servidor = app.listen(0, "127.0.0.1", r); });
    base = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
    console.error = logOriginal;
    await new Promise((r) => servidor.close(r));
    await db.cerrarConexion();
    DataBase.instance = null;
});

const post = async (ruta, cuerpo, headers = {}) => {
    const r = await fetch(base + ruta, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(cuerpo) });
    return { status: r.status, cuerpo: await r.json().catch(() => null) };
};
const paciente = (extra = {}) => ({ nombre: "Camila", apellido: "Rojas", tipo_documento: "rut", documento: "19.169.587-9", correo: "camila@ejemplo.cl", telefono: "+56912345678", ...extra });
const aceptacionDe = (p) => ({ codigo: p.codigo, id_plantilla: p.id_plantilla, version: p.version, sha256: p.sha256 });

test("seleccionarVigentes: política (con casilla) y derechos y deberes (lectura)", async () => {
    const r = await fetch(`${base}/consentimientos/seleccionarVigentes`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "no-store");
    const cuerpo = await r.json();
    plantillas = cuerpo.plantillas;
    assert.deepEqual(plantillas.map((p) => p.codigo).sort(), ["derechos_deberes_paciente", "tratamiento_datos"]);
    for (const p of plantillas) assert.match(p.sha256, /^[0-9a-f]{64}$/);
});

test("registrarAceptacion: guarda texto exacto, huellas, IP real, constancia y evento sellado", async () => {
    const politica = plantillas.find((p) => p.codigo === "tratamiento_datos");
    const r = await post("/consentimientos/registrarAceptacion",
        { aceptaciones: [aceptacionDe(politica)], paciente: paciente(), id_profesional: ID_PROFESIONAL },
        { "X-Forwarded-For": "200.27.10.5", "User-Agent": "PruebaNavegador/1.0" });
    assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
    assert.match(r.cuerpo.token_aceptacion, /^ca_[0-9a-f]{32}$/);
    assert.match(r.cuerpo.codigo_verificacion, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    tokenValido = r.cuerpo.token_aceptacion;
    codigoValido = r.cuerpo.codigo_verificacion;

    const [fila] = await db.ejecutarQuery("SELECT * FROM consentimiento_aceptacion WHERE token_aceptacion = ?", [tokenValido]);
    assert.equal(fila.plantilla_codigo, "tratamiento_datos");
    assert.equal(fila.plantilla_version, politica.version);
    assert.equal(fila.plantilla_sha256, politica.sha256);
    assert.match(fila.texto_sha256, /^[0-9a-f]{64}$/);
    assert.ok(fila.texto_renderizado.length > 500 && !fila.texto_renderizado.includes("{{empresa."), "texto interpolado con los datos de la clínica");
    assert.equal(fila.ip, "200.27.10.5", "IP real del paciente (trust proxy)");
    assert.equal(fila.user_agent, "PruebaNavegador/1.0");
    assert.equal(fila.paciente_documento, "191695879");
    assert.equal(fila.id_profesional, ID_PROFESIONAL);
    assert.equal(fila.id_reserva, null);
    assert.ok(fila.aceptado_at instanceof Date);

    // Constancia: PDF real, subido una vez, con su huella
    assert.equal(subidas.length, 1);
    assert.equal(subidas[0].tipo, "application/pdf");
    assert.equal(subidas[0].buffer.subarray(0, 5).toString(), "%PDF-");
    assert.equal(fila.pdf_key, subidas[0].key);
    assert.match(fila.pdf_sha256, /^[0-9a-f]{64}$/);

    // Evidencia encadenada y sellada
    const [evento] = await db.ejecutarQuery("SELECT * FROM firma_evento WHERE id_aceptacion = ? ", [fila.id_aceptacion]);
    assert.equal(evento.tipo_evento, "consentimiento_aceptado");
    assert.equal(evento.actor_tipo, "paciente");
    assert.match(evento.hash_evento, /^[0-9a-f]{64}$/);
    assert.match(evento.sello_hmac, /^[0-9a-f]{64}$/);
    assert.equal(evento.ip, "200.27.10.5");

    // Constancia por correo al paciente (simulado)
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(correos.some((c) => JSON.stringify(c).includes("camila@ejemplo.cl")), "se envía la constancia al correo del paciente");
});

test("la evidencia no se puede modificar ni borrar (triggers append-only)", async () => {
    await assert.rejects(db.ejecutarQuery("UPDATE firma_evento SET ip = '1.1.1.1' WHERE tipo_evento = 'consentimiento_aceptado'"), /append-only/);
    await assert.rejects(db.ejecutarQuery("DELETE FROM firma_evento WHERE tipo_evento = 'consentimiento_aceptado'"), /append-only/);
});

test("texto desactualizado o alterado → 409 actaDesactualizada (el paciente debe releer)", async () => {
    const politica = plantillas.find((p) => p.codigo === "tratamiento_datos");
    for (const alterada of [{ ...aceptacionDe(politica), sha256: "0".repeat(64) }, { ...aceptacionDe(politica), version: politica.version + 1 }]) {
        const r = await post("/consentimientos/registrarAceptacion", { aceptaciones: [alterada], paciente: paciente() });
        assert.equal(r.status, 409);
        assert.equal(r.cuerpo.message, "actaDesactualizada");
    }
});

test("sin la casilla de la política, RUT o correo inválidos → rechazo sin guardar", async () => {
    const politica = plantillas.find((p) => p.codigo === "tratamiento_datos");
    const antes = (await db.ejecutarQuery("SELECT COUNT(*) AS n FROM consentimiento_aceptacion"))[0].n;
    assert.equal((await post("/consentimientos/registrarAceptacion", { aceptaciones: [], paciente: paciente() })).status, 400);
    const lectura = plantillas.find((p) => p.codigo === "derechos_deberes_paciente");
    assert.equal((await post("/consentimientos/registrarAceptacion", { aceptaciones: [aceptacionDe(lectura)], paciente: paciente() })).status, 400);
    const rut = await post("/consentimientos/registrarAceptacion", { aceptaciones: [aceptacionDe(politica)], paciente: paciente({ documento: "12.345.678-0" }) });
    assert.equal(rut.status, 422); assert.equal(rut.cuerpo.message, "rutInvalido");
    const correo = await post("/consentimientos/registrarAceptacion", { aceptaciones: [aceptacionDe(politica)], paciente: paciente({ correo: "no-es-correo" }) });
    assert.equal(correo.status, 422); assert.equal(correo.cuerpo.message, "correoInvalido");
    assert.equal((await post("/consentimientos/registrarAceptacion", { aceptaciones: [aceptacionDe(politica)] })).status, 400);
    const despues = (await db.ejecutarQuery("SELECT COUNT(*) AS n FROM consentimiento_aceptacion"))[0].n;
    assert.equal(despues, antes);
});

test("vinculación: une la aceptación con la reserva y el paciente; un token solo sirve una vez", async () => {
    await vincularAceptacionConReserva(tokenValido, 624, RUT_PACIENTE);
    const [fila] = await db.ejecutarQuery("SELECT id_reserva, id_paciente, vinculado_at FROM consentimiento_aceptacion WHERE token_aceptacion = ?", [tokenValido]);
    assert.equal(fila.id_reserva, 624);
    assert.equal(fila.id_paciente, 2283);
    assert.ok(fila.vinculado_at instanceof Date);
    // Reusar el token no pisa la vinculación
    await vincularAceptacionConReserva(tokenValido, 999, RUT_PACIENTE);
    const [igual] = await db.ejecutarQuery("SELECT id_reserva FROM consentimiento_aceptacion WHERE token_aceptacion = ?", [tokenValido]);
    assert.equal(igual.id_reserva, 624);
});

test("vinculación nunca lanza: token ausente, malformado o inexistente → la reserva sigue", async () => {
    for (const t of [null, undefined, "", "hola", "ca_123", `ca_${"f".repeat(32)}`, "' OR 1=1 --"]) {
        await assert.doesNotReject(vincularAceptacionConReserva(t, 1, RUT_PACIENTE));
    }
});

test("rutas del dashboard exigen sesión (401) y no exponen datos", async () => {
    for (const ruta of ["/consentimientos/listarPorPaciente", "/consentimientos/descargarAceptacion", "/consentimientos/enviarAceptacionCorreo", "/consentimientos/revocarAceptacion"]) {
        const r = await post(ruta, { id_paciente: 2283 });
        assert.equal(r.status, 401, ruta);
    }
});

test("límite de peticiones: registrarAceptacion admite 10 por IP cada 10 minutos", async () => {
    const politica = plantillas.find((p) => p.codigo === "tratamiento_datos");
    let ultimo;
    for (let i = 0; i < 12; i++) {
        ultimo = await post("/consentimientos/registrarAceptacion", { aceptaciones: [{ ...aceptacionDe(politica), sha256: "0".repeat(64) }], paciente: paciente() }, { "X-Forwarded-For": "200.27.10.99" });
    }
    assert.equal(ultimo.status, 429);
    assert.equal(ultimo.cuerpo.message, "demasiadasSolicitudes");
});

test("verificación pública (QR): confirma la constancia sin mostrar datos del paciente y queda en bitácora", async () => {
    const r = await fetch(`${base}/verificacion/${codigoValido}`);
    assert.equal(r.status, 200);
    const v = await r.json();
    assert.equal(v.existe, true);
    assert.equal(v.tipo, "consentimiento");
    assert.equal(v.tipo_documento, "tratamiento_datos");
    assert.equal(v.revocado_at, null);
    const texto = JSON.stringify(v);
    for (const privado of ["Camila", "Rojas", "191695879", "camila@ejemplo.cl", "+56912345678", "200.27.10.5"]) {
        assert.ok(!texto.includes(privado), `no expone ${privado}`);
    }
    await new Promise((res) => setTimeout(res, 200));
    const [acceso] = await db.ejecutarQuery(
        "SELECT a.accion FROM documento_acceso a JOIN consentimiento_aceptacion c ON c.id_aceptacion = a.id_aceptacion WHERE c.codigo_verificacion = ? AND a.accion = 'verificado_publico'", [codigoValido]);
    assert.equal(acceso?.accion, "verificado_publico");
    for (const malo of ["XXXX-0000", "nada", "' OR 1=1 --"]) {
        const n = await (await fetch(`${base}/verificacion/${encodeURIComponent(malo)}`)).json();
        assert.equal(n.existe, false);
    }
});
