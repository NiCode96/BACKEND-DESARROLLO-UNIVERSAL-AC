/*
    Categoría del profesional de punta a punta: HTTP → controlador real → MySQL.
    Requiere una base de PRUEBA con `profesionales` y la migración
    migraciones/2026-11-01_categoria_profesional.sql aplicada.

      DB_HOST=127.0.0.1 DB_PORT=3407 DB_USER=prueba DB_PASS=prueba DB_DATABASE=ac_logo \
        node --test pruebas/profesionales/categoriaProfesional.e2e.mjs
*/
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";

if (!process.env.DB_DATABASE || process.env.DB_DATABASE.toLowerCase().includes("produccion")) {
    console.error("Configura DB_* con una base de PRUEBA."); process.exit(1);
}
const { default: Controller } = await import("../../controller/ProfesionalesController.js");
const { default: rutas } = await import("../../view/profesionalesRoutes.js");
const { default: DataBase } = await import("../../config/Database.js");
const db = DataBase.getInstance();

let servidor, base, idNuevo;
const logs = [];
const logOriginal = console.log;

before(async () => {
    console.log = (...a) => { logs.push(a.join(" ")); };
    const app = express();
    app.use(express.json());
    const sesion = (req, _r, next) => { req.sesionClerk = { sub: "user_prueba" }; next(); };
    app.post("/ok/insertar", sesion, Controller.insertarProfesionalController);
    app.post("/ok/actualizar", sesion, Controller.actualizarProfesionalController);
    app.use("/profesionales", rutas);
    await new Promise((r) => { servidor = app.listen(0, "127.0.0.1", r); });
    base = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
    if (idNuevo) await db.ejecutarQuery("DELETE FROM profesionales WHERE id_profesional = ?", [idNuevo]);
    console.log = logOriginal;
    await new Promise((r) => servidor.close(r));
    await db.cerrarConexion();
    DataBase.instance = null;
});

const post = async (ruta, cuerpo, headers = {}) => {
    const r = await fetch(base + ruta, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(cuerpo) });
    return { status: r.status, cuerpo: await r.json().catch(() => null) };
};
const datos = { nombreProfesional: "Prueba Categoria", descripcionProfesional: "Cirujano dentista", correoContacto: "prueba@ejemplo.cl", numeroTelefono: "+56911111111", rutProfesional: "111111111" };
const categoriaEnBase = async () => (await db.ejecutarQuery("SELECT categoriaProfesional FROM profesionales WHERE id_profesional = ?", [idNuevo]))[0]?.categoriaProfesional;

test("router real: insertar y actualizar sin sesión → 401", async () => {
    assert.equal((await post("/profesionales/insertarProfesional", { ...datos, categoriaProfesional: "X" })).status, 401);
    assert.equal((await post("/profesionales/actualizarProfesional", { ...datos, id_profesional: 1, categoriaProfesional: "X" })).status, 401);
});

test("insertar con categoría la guarda limpia", async () => {
    const r = await post("/ok/insertar", { ...datos, categoriaProfesional: "  Odontología \n general " });
    assert.equal(r.status, 200);
    idNuevo = (await db.ejecutarQuery("SELECT MAX(id_profesional) AS id FROM profesionales WHERE nombreProfesional = ?", [datos.nombreProfesional]))[0].id;
    assert.equal(await categoriaEnBase(), "Odontología general");
});

test("actualizar SIN el campo conserva la categoría (pantallas antiguas no la borran)", async () => {
    const r = await post("/ok/actualizar", { ...datos, descripcionProfesional: "Ortodoncista", id_profesional: idNuevo });
    assert.equal(r.status, 200);
    assert.equal(await categoriaEnBase(), "Odontología general");
});

test("actualizar con otra categoría la cambia; con \"\" la deja en NULL", async () => {
    assert.equal((await post("/ok/actualizar", { ...datos, id_profesional: idNuevo, categoriaProfesional: "Ortodoncia" })).status, 200);
    assert.equal(await categoriaEnBase(), "Ortodoncia");
    assert.equal((await post("/ok/actualizar", { ...datos, id_profesional: idNuevo, categoriaProfesional: "" })).status, 200);
    assert.equal(await categoriaEnBase(), null);
});

test("categoría inválida → 400 y no se guarda nada", async () => {
    await post("/ok/actualizar", { ...datos, id_profesional: idNuevo, categoriaProfesional: "Psicología" });
    for (const malo of ["<b>x</b>", "x'; DROP TABLE profesionales;--", "a".repeat(61), 7, ["Odontología"]]) {
        const r = await post("/ok/actualizar", { ...datos, id_profesional: idNuevo, categoriaProfesional: malo });
        assert.equal(r.status, 400, JSON.stringify(malo));
        assert.equal(r.cuerpo.message, "categoria-invalida");
    }
    assert.equal(await categoriaEnBase(), "Psicología");
    const r = await post("/ok/insertar", { ...datos, nombreProfesional: "No Debe Existir", categoriaProfesional: "<script>" });
    assert.equal(r.status, 400);
    assert.equal((await db.ejecutarQuery("SELECT COUNT(*) AS n FROM profesionales WHERE nombreProfesional = 'No Debe Existir'"))[0].n, 0);
});

test("el SELECT del listado público devuelve la categoría", async () => {
    const { default: Profesionales } = await import("../../model/Profesionales.js");
    const lista = await new Profesionales().seleccionarTodosProfesionales?.() ?? await db.ejecutarQuery("SELECT * FROM profesionales WHERE estado_Profesional <> 0");
    const yo = lista.find((p) => p.id_profesional === idNuevo);
    assert.equal(yo.categoriaProfesional, "Psicología");
});

test("los logs ya no traen RUT, teléfono ni correo", () => {
    const delControlador = logs.filter((l) => l.startsWith("[profesionales]"));
    assert.ok(delControlador.length > 0);
    assert.ok(logs.every((l) => !l.includes("111111111") && !l.includes("+56911111111") && !l.includes("prueba@ejemplo.cl")), logs.join("\n"));
});
