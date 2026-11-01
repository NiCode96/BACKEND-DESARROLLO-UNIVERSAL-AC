/*
    Prueba de punta a punta del logo: HTTP → router/controlador reales → MySQL.

    Requiere una base de PRUEBA con datos_empresa y la migración
    migraciones/2026-11-01_logo_empresa.sql aplicada. Nunca apuntar a producción:
    el script escribe en datos_empresa (y al final deja el logo en NULL).

      DB_HOST=127.0.0.1 DB_PORT=3407 DB_USER=prueba DB_PASS=prueba DB_DATABASE=ac_logo \
        node --test pruebas/datosEmpresa/logoEmpresa.e2e.mjs

    Clerk no se puede verificar sin credenciales: se comprueba que el router real
    rechace sin token (401), y las llamadas autorizadas montan el mismo
    controlador con una sesión simulada (req.sesionClerk), igual que la deja
    middleware/exigirSesionClerk.js.
*/
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";

if (!process.env.DB_DATABASE || process.env.DB_DATABASE.toLowerCase().includes("produccion")) {
    console.error("Configura DB_* con una base de PRUEBA antes de correr este script.");
    process.exit(1);
}

const { default: datosEmpresaRoutes } = await import("../../view/datosEmpresaRoutes.js");
const { default: DatosEmpresaController } = await import("../../controller/DatosEmpresaController.js");
const { default: DataBase } = await import("../../config/Database.js");

const ID_REAL = "4e85bc99-8b27-4e61-244a-49a130200f00";
let servidor;
let base;
const auditoria = [];
const logOriginal = console.log;

before(async () => {
    console.log = (...args) => {
        if (String(args[0]).startsWith("[AUDITORIA]")) auditoria.push(args.join(" "));
        else logOriginal(...args);
    };
    const app = express();
    app.use(express.json());
    // Con sesión simulada, mismo controlador que la ruta real
    app.post("/autorizado/actualizarLogo", (req, _res, next) => {
        req.sesionClerk = { sub: "user_prueba_e2e" };
        next();
    }, DatosEmpresaController.actualizarLogo);
    // Router real (público + gate de Clerk)
    app.use("/datosempresa", datosEmpresaRoutes);
    await new Promise((r) => { servidor = app.listen(0, "127.0.0.1", r); });
    base = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
    await DataBase.getInstance().ejecutarQuery("UPDATE datos_empresa SET logoEmpresa = NULL WHERE id_empresa = 1");
    console.log = logOriginal;
    await new Promise((r) => servidor.close(r));
    await DataBase.getInstance().cerrarConexion();
    DataBase.instance = null; // el hook de salida de Database.js no debe cerrarlo otra vez
});

const post = async (ruta, cuerpo, headers = {}) => {
    const res = await fetch(`${base}${ruta}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(cuerpo),
    });
    return { status: res.status, cuerpo: await res.json().catch(() => null) };
};
const logoEnBase = async () =>
    (await DataBase.getInstance().ejecutarQuery("SELECT logoEmpresa FROM datos_empresa WHERE id_empresa = 1"))[0].logoEmpresa;

test("sin token: el router real responde 401 y no toca la base", async () => {
    const antes = await logoEnBase();
    const r = await post("/datosempresa/actualizarLogo", { id_empresa: 1, logoEmpresa: ID_REAL });
    assert.equal(r.status, 401);
    assert.equal(r.cuerpo.message, "USUARIO-SIN-AUTENTICACION");
    const r2 = await post("/datosempresa/actualizarLogo", { id_empresa: 1, logoEmpresa: ID_REAL }, { Authorization: "Bearer token-falso" });
    assert.equal(r2.status, 401);
    assert.equal(await logoEnBase(), antes);
});

test("guardar un logo válido", async () => {
    const r = await post("/autorizado/actualizarLogo", { id_empresa: 1, logoEmpresa: ` ${ID_REAL} ` });
    assert.equal(r.status, 200);
    assert.deepEqual(r.cuerpo, { message: true, logoEmpresa: ID_REAL });
    assert.equal(await logoEnBase(), ID_REAL);
});

test("el GET público devuelve el logo junto al resto de los datos", async () => {
    const res = await fetch(`${base}/datosempresa/seleccionartodos`);
    assert.equal(res.status, 200);
    const [empresa] = await res.json();
    assert.equal(empresa.logoEmpresa, ID_REAL);
    assert.equal(empresa.empresaNombre, "Clinica Salud Mujer");
});

test("guardar el resto de los datos NO borra el logo", async () => {
    const { default: DatosEmpresa } = await import("../../model/DatosEmpresa.js");
    const [e] = await new DatosEmpresa().seleccionarDatosEmpresa();
    await new DatosEmpresa().actualizarDatosEmpresa(
        e.empresaNombre, e.contactoTelefono, e.contactoWhatsapp, e.contactoEmail, e.contactoDireccion,
        e.contactoUrlMapa, e.sobreNosotrosTitulo, e.sobreNosotrosParrafo1, e.sobreNosotrosParrafo2,
        e.socialInstagramUrl, e.socialInstagramHandle, e.socialFacebookUrl, e.socialTwitterUrl,
        e.socialLinkedinUrl, e.socialTiktokUrl, e.socialYoutubeUrl, e.socialOtraUrl, e.socialOtraEtiqueta, 1,
    );
    assert.equal(await logoEnBase(), ID_REAL);
});

test("valores inválidos: 400 y la base queda igual", async () => {
    const casos = [
        [{ id_empresa: 1, logoEmpresa: "https://malo.com/x.png" }, "logo-invalido"],
        [{ id_empresa: 1, logoEmpresa: "x' OR '1'='1" }, "logo-invalido"],
        [{ id_empresa: 1, logoEmpresa: "a".repeat(101) }, "logo-invalido"],
        [{ id_empresa: 1, logoEmpresa: 42 }, "logo-invalido"],
        [{ id_empresa: "1 OR 1=1", logoEmpresa: ID_REAL }, "empresa-invalida"],
        [{ id_empresa: 0, logoEmpresa: ID_REAL }, "empresa-invalida"],
        [{ logoEmpresa: ID_REAL }, "empresa-invalida"],
    ];
    for (const [cuerpo, mensaje] of casos) {
        const r = await post("/autorizado/actualizarLogo", cuerpo);
        assert.equal(r.status, 400, JSON.stringify(cuerpo));
        assert.equal(r.cuerpo.message, mensaje, JSON.stringify(cuerpo));
    }
    assert.equal(await logoEnBase(), ID_REAL);
});

test("empresa que no existe: 404", async () => {
    const r = await post("/autorizado/actualizarLogo", { id_empresa: 999, logoEmpresa: ID_REAL });
    assert.equal(r.status, 404);
    assert.equal(r.cuerpo.message, "empresa-no-encontrada");
});

test("quitar el logo guarda NULL y el GET lo devuelve null", async () => {
    const r = await post("/autorizado/actualizarLogo", { id_empresa: 1, logoEmpresa: "" });
    assert.equal(r.status, 200);
    assert.deepEqual(r.cuerpo, { message: true, logoEmpresa: null });
    assert.equal(await logoEnBase(), null);
    const [empresa] = await (await fetch(`${base}/datosempresa/seleccionartodos`)).json();
    assert.equal(empresa.logoEmpresa, null);
});

test("bitácora: registra quién y qué, sin datos personales", () => {
    assert.ok(auditoria.some((l) => l.includes("logoEmpresa actualizado") && l.includes("usuario=user_prueba_e2e") && l.includes("id_empresa=1")));
    assert.ok(auditoria.some((l) => l.includes("logoEmpresa quitado")));
    assert.ok(auditoria.every((l) => !/@|\+56|Orompello/.test(l)));
});
