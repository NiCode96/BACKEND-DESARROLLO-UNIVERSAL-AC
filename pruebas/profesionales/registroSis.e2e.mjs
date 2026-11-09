/*
    Fase 4 de docs/firma de punta a punta: listado de profesionales sin columnas internas,
    foto y categoría al crear y editar, validación de RUT, y N° de registro de la
    Superintendencia de Salud (declarar, certificado, verificar, rechazar, descargar).

    HTTP → routers y controladores reales → MySQL. Clerk y R2 se SIMULAN.

    Requiere una base de PRUEBA con el dump, las migraciones de docs/firma y las de migraciones/:
      DB_HOST=127.0.0.1 DB_PORT=3407 DB_USER=prueba DB_PASS=prueba DB_DATABASE=ac_sis \
        node --experimental-test-module-mocks --test pruebas/profesionales/registroSis.e2e.mjs
*/
import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";
import express from "express";

if (!process.env.DB_DATABASE || /produccion/i.test(process.env.DB_DATABASE)) {
    console.error("Configura DB_* con una base de PRUEBA."); process.exit(1);
}
process.env.FIRMA_HMAC_CLAVE ||= "clave-de-prueba-solo-para-tests-0123456789abcdef";
process.env.FIRMA_HMAC_VERSION ||= "1";

// ── Usuarios simulados (cabecera X-Prueba-Usuario) ──────────────────────────
const USUARIOS = {
    admin: { clerkId: "user_admin_prueba", rol: "admin-clinica", nombre: "Admin Prueba", idProfesional: null },
    duenio: { clerkId: "user_duenio_prueba", rol: "profesional-medico", nombre: "Dueño Prueba", idProfesional: null },
    otro: { clerkId: "user_otro_prueba", rol: "profesional-medico", nombre: "Otro Prueba", idProfesional: 999999 },
};
const usuarioDe = (req) => USUARIOS[req.get("x-prueba-usuario")] || null;
const conSesion = (req, res, next) => (usuarioDe(req) ? next() : res.status(401).json({ message: "noAutorizado" }));

mock.module("../../middleware/exigirSesionClerk.js", {
    namedExports: { exigirSesionClerk: (req, res, next) => { req.sesionClerk = usuarioDe(req) ? { sub: usuarioDe(req).clerkId } : null; return conSesion(req, res, next); } },
});
mock.module("../../middleware/exigirUsuarioClerk.js", {
    namedExports: { exigirUsuarioClerk: (req, res, next) => { req.usuario = usuarioDe(req); return conSesion(req, res, next); } },
});
mock.module("../../middleware/verificarUsuarioClerk.js", {
    namedExports: { verificarUsuarioClerk: (req, _res, next) => { req.usuario = usuarioDe(req); next(); } },
});
const subidas = [];
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

const { default: rutas } = await import("../../view/profesionalesRoutes.js");
const { default: DataBase } = await import("../../config/Database.js");
const db = DataBase.getInstance();

// Columnas que nunca deben salir en una respuesta
const INTERNAS = ["registro_sis_certificado_key", "registro_sis_certificado_mime", "registro_sis_certificado_sha256",
    "registro_sis_verificado_por", "registro_sis_verificado_at", "registro_sis_motivo_rechazo"];

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
const RUT_VALIDO = "11.111.111-1";
let servidor, base, idNuevo;
const logOriginal = console.error;
const errores = [];

before(async () => {
    console.error = (...a) => errores.push(a.join(" "));
    // El verificador debe existir en usuario_plataforma (FK de registro_sis_verificado_por)
    const [{ id }] = await db.ejecutarQuery("SELECT UUID() AS id");
    USUARIOS.admin.idUsuario = id;
    await db.ejecutarQuery(
        "INSERT INTO usuario_plataforma (id_usuario, clerk_user_id, nombre, rol) VALUES (UUID_TO_BIN(?), ?, ?, ?)",
        [id, USUARIOS.admin.clerkId, USUARIOS.admin.nombre, USUARIOS.admin.rol]);
    const app = express();
    app.use(express.json());
    app.use("/profesionales", rutas);
    await new Promise((r) => { servidor = app.listen(0, "127.0.0.1", r); });
    base = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
    console.error = logOriginal;
    await new Promise((r) => servidor.close(r));
    await db.cerrarConexion();
    DataBase.instance = null;
});

const post = async (ruta, cuerpo, usuario) => {
    const headers = { "Content-Type": "application/json", ...(usuario ? { "X-Prueba-Usuario": usuario } : {}) };
    const r = await fetch(base + ruta, { method: "POST", headers, body: JSON.stringify(cuerpo) });
    return { status: r.status, cuerpo: await r.json().catch(() => null) };
};
const postForm = async (ruta, campos, archivo, usuario) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(campos)) fd.append(k, String(v));
    if (archivo) fd.append("certificado", new Blob([archivo.buffer], { type: archivo.tipo }), archivo.nombre);
    const r = await fetch(base + ruta, { method: "POST", headers: { "X-Prueba-Usuario": usuario }, body: fd });
    return { status: r.status, cuerpo: await r.json().catch(() => null) };
};
const profesional = (extra = {}) => ({
    nombreProfesional: "Profesional Prueba SIS", descripcionProfesional: "Descripción", correoContacto: "sis@prueba.cl",
    numeroTelefono: "+56911111111", rutProfesional: RUT_VALIDO, categoriaProfesional: "Psicología", ...extra,
});
const fila = async () => (await db.ejecutarQuery("SELECT * FROM profesionales WHERE id_profesional = ?", [idNuevo]))[0];
const eventos = async (tipo) => (await db.ejecutarQuery(
    "SELECT * FROM firma_evento WHERE id_profesional = ? AND tipo_evento = ?", [idNuevo, tipo])).length;

test("sin sesión: crear y editar responden 401", async () => {
    assert.equal((await post("/profesionales/insertarProfesional", profesional())).status, 401);
    assert.equal((await post("/profesionales/actualizarProfesional", profesional({ id_profesional: 1 }))).status, 401);
});

test("crear: rechaza RUT inválido, id de foto inválido y N° de registro con letras", async () => {
    assert.deepEqual((await post("/profesionales/insertarProfesional", profesional({ rutProfesional: "11.111.111-2" }), "admin")).cuerpo, { message: "rutInvalido" });
    assert.deepEqual((await post("/profesionales/insertarProfesional", profesional({ imagenProfesional: "../otra-cosa" }), "admin")).cuerpo, { message: "archivoInvalido" });
    assert.deepEqual((await post("/profesionales/insertarProfesional", profesional({ registro_sis_numero: "12a" }), "admin")).cuerpo, { message: "datoinvalido" });
    assert.equal((await post("/profesionales/insertarProfesional", profesional({ categoriaProfesional: "x".repeat(200) }), "admin")).status, 400, "categoría inválida sigue respondiendo como antes");
});

test("crear: guarda foto, categoría y N° de registro declarado con su evento", async () => {
    const r = await post("/profesionales/insertarProfesional", profesional({ imagenProfesional: "foto-abc-123", registro_sis_numero: "123456" }), "admin");
    assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
    [{ id_profesional: idNuevo }] = await db.ejecutarQuery("SELECT MAX(id_profesional) AS id_profesional FROM profesionales");
    const f = await fila();
    assert.equal(f.imagenProfesional, "foto-abc-123");
    assert.equal(f.categoriaProfesional, "Psicología");
    assert.equal(f.registro_sis_numero, "123456");
    assert.equal(f.registro_sis_estado, "declarado");
    assert.equal(await eventos("registro_sis_declarado"), 1);
});

test("listado público y por id: traen categoría, foto, registro y firma_estado, y nunca las columnas internas", async () => {
    const r = await fetch(`${base}/profesionales/seleccionarTodosProfesionales`);
    assert.equal(r.status, 200);
    const lista = await r.json();
    const p = lista.find((x) => x.id_profesional === idNuevo);
    assert.ok(p, "el profesional nuevo aparece");
    assert.equal(p.categoriaProfesional, "Psicología");
    assert.equal(p.imagenProfesional, "foto-abc-123");
    assert.equal(p.registro_sis_numero, "123456");
    assert.equal(p.registro_sis_estado, "declarado");
    assert.equal(p.firma_estado, "ninguna");
    for (const x of lista) for (const c of INTERNAS) assert.equal(c in x, false, `${c} no debe salir en el listado`);

    const porId = await (await fetch(`${base}/profesionales/seleccionarProfesional`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id_profesional: idNuevo }) })).json();
    assert.equal(porId[0].categoriaProfesional, "Psicología");
    for (const c of INTERNAS) assert.equal(c in porId[0], false, `${c} no debe salir por id`);
});

test("editar: sin imagenProfesional conserva la foto y la categoría; \"\" quita la foto; un id nuevo la cambia", async () => {
    const { categoriaProfesional, ...sinCategoria } = profesional({ id_profesional: idNuevo, nombreProfesional: "Nombre editado" });
    assert.equal(categoriaProfesional, "Psicología");
    assert.equal((await post("/profesionales/actualizarProfesional", sinCategoria, "admin")).status, 200);
    let f = await fila();
    assert.equal(f.nombreProfesional, "Nombre editado");
    assert.equal(f.imagenProfesional, "foto-abc-123", "sin el campo no se toca la foto");
    assert.equal(f.categoriaProfesional, "Psicología", "sin el campo no se toca la categoría");

    assert.equal((await post("/profesionales/actualizarProfesional", { ...sinCategoria, imagenProfesional: "" }, "admin")).status, 200);
    assert.equal((await fila()).imagenProfesional, null);
    assert.equal((await post("/profesionales/actualizarProfesional", { ...sinCategoria, imagenProfesional: "foto-nueva-9" }, "admin")).status, 200);
    f = await fila();
    assert.equal(f.imagenProfesional, "foto-nueva-9");
    assert.equal(f.registro_sis_estado, "declarado", "editar datos no toca el registro SIS");
    assert.deepEqual((await post("/profesionales/actualizarProfesional", { ...sinCategoria, rutProfesional: "123" }, "admin")).cuerpo, { message: "rutInvalido" });
});

test("registro SIS: otro profesional no puede declarar; el dueño sí, con certificado PDF", async () => {
    assert.equal((await postForm("/profesionales/actualizarRegistroSis", { id_profesional: idNuevo, registro_sis_numero: "777" }, null, "otro")).status, 403);
    USUARIOS.duenio.idProfesional = idNuevo;
    const r = await postForm("/profesionales/actualizarRegistroSis", { id_profesional: idNuevo, registro_sis_numero: "654321" },
        { buffer: PDF, tipo: "application/pdf", nombre: "certificado.pdf" }, "duenio");
    assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.registroSis.numero, "654321");
    assert.equal(r.cuerpo.registroSis.estado, "declarado");
    assert.equal(r.cuerpo.registroSis.tiene_certificado, true);
    assert.equal("registro_sis_certificado_key" in r.cuerpo.registroSis, false);
    assert.equal(subidas.at(-1).tipo, "application/pdf");
    assert.equal(await eventos("registro_sis_declarado"), 2);
});

test("registro SIS: un archivo que no es PDF/JPG/PNG se rechaza aunque diga .pdf", async () => {
    const r = await postForm("/profesionales/actualizarRegistroSis", { id_profesional: idNuevo, registro_sis_numero: "654321" },
        { buffer: Buffer.from("MZ ejecutable"), tipo: "application/pdf", nombre: "falso.pdf" }, "admin");
    assert.deepEqual(r.cuerpo, { message: "archivoInvalido" });
});

test("verificar: solo administradores; rechazar exige motivo; verificar registra quién y cuándo", async () => {
    assert.equal((await post("/profesionales/verificarRegistroSis", { id_profesional: idNuevo, decision: "verificado" }, "duenio")).status, 403);
    assert.equal((await post("/profesionales/verificarRegistroSis", { id_profesional: idNuevo, decision: "rechazado" }, "admin")).status, 400);

    let r = await post("/profesionales/verificarRegistroSis", { id_profesional: idNuevo, decision: "rechazado", motivo: "No figura en el RNPI" }, "admin");
    assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.registroSis.estado, "rechazado");
    assert.equal(r.cuerpo.registroSis.motivo_rechazo, "No figura en el RNPI");

    r = await post("/profesionales/verificarRegistroSis", { id_profesional: idNuevo, decision: "verificado" }, "admin");
    assert.equal(r.cuerpo.registroSis.estado, "verificado");
    assert.equal(r.cuerpo.registroSis.verificado_por, "Admin Prueba");
    assert.match(r.cuerpo.registroSis.verificado_at, /Z$/);
    assert.equal(r.cuerpo.registroSis.motivo_rechazo, null);
    assert.equal(await eventos("registro_sis_rechazado"), 1);
    assert.equal(await eventos("registro_sis_verificado"), 1);
});

test("descargar certificado: el dueño y el administrador sí, otro profesional no", async () => {
    assert.equal((await post("/profesionales/descargarCertificadoSis", { id_profesional: idNuevo }, "otro")).status, 403);
    for (const u of ["duenio", "admin"]) {
        const r = await post("/profesionales/descargarCertificadoSis", { id_profesional: idNuevo }, u);
        assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
        assert.match(JSON.stringify(r.cuerpo), /https:\/\/r2\.prueba\//);
    }
});

test("cambiar el número vuelve a 'declarado' y limpia la verificación", async () => {
    const r = await postForm("/profesionales/actualizarRegistroSis", { id_profesional: idNuevo, registro_sis_numero: "111222" }, null, "admin");
    assert.equal(r.cuerpo.registroSis.estado, "declarado");
    assert.equal(r.cuerpo.registroSis.verificado_por, null);
    assert.equal(r.cuerpo.registroSis.tiene_certificado, true, "el certificado anterior se conserva");
});

test("ningún error inesperado en el log", () => {
    assert.deepEqual(errores.filter((e) => !/\[CLERK\]|ExperimentalWarning/.test(e)), []);
});
