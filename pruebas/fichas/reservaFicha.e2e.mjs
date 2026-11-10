/*
    Reserva de la ficha clínica (Ley 20.584) de punta a punta: un profesional ve solo
    las fichas que escribió, la administración ve todas, la ficha no se modifica después
    de creada y solo la administración la da de baja.

    HTTP → router y controlador reales → MySQL. Clerk se SIMULA.

    Requiere una base de PRUEBA con el dump, las migraciones de docs/firma y las de migraciones/:
      DB_HOST=127.0.0.1 DB_PORT=3407 DB_USER=prueba DB_PASS=prueba DB_DATABASE=ac_fichas \
        node --experimental-test-module-mocks --test pruebas/fichas/reservaFicha.e2e.mjs
*/
import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";
import express from "express";

if (!process.env.DB_DATABASE || /produccion/i.test(process.env.DB_DATABASE)) {
    console.error("Configura DB_* con una base de PRUEBA."); process.exit(1);
}

const ID_PACIENTE = 2283;
const USUARIOS = {
    ana: { clerkId: "user_ana", rol: "profesional-medico", nombre: "Ana Prueba" },
    beto: { clerkId: "user_beto", rol: "profesional-odontologo", nombre: "Beto Prueba" },
    clon: { clerkId: "user_clon", rol: "profesional-medico", nombre: "Clon Prueba" },
    admin: { clerkId: "user_admin_f", rol: "admin-clinica", nombre: "Admin", idProfesional: null },
    recepcion: { clerkId: "user_recep_f", rol: "recepcion", nombre: "Recepción", idProfesional: null },
};
mock.module("../../middleware/exigirUsuarioClerk.js", {
    namedExports: {
        exigirUsuarioClerk: (req, res, next) => {
            const u = USUARIOS[req.get("x-prueba-usuario")];
            if (!u) return res.status(401).json({ message: "noAutorizado" });
            req.usuario = { ...u };
            return next();
        },
    },
});

const { default: rutas } = await import("../../view/fichaRoutes.js");
const { default: DataBase } = await import("../../config/Database.js");
const db = DataBase.getInstance();
let servidor, base;

const post = async (ruta, cuerpo, usuario) => {
    const r = await fetch(base + ruta, { method: "POST", headers: { "Content-Type": "application/json", "X-Prueba-Usuario": usuario }, body: JSON.stringify(cuerpo) });
    return { status: r.status, cuerpo: await r.json().catch(() => null) };
};
const ficha = (extra = {}) => ({ id_paciente: ID_PACIENTE, tipoAtencion: "Evolución General", motivoConsulta: "Control", fechaConsulta: "2026-11-10", ...extra });
const fichasDe = async (usuario) => (await post("/ficha/seleccionarFichasPaciente", { id_paciente: ID_PACIENTE }, usuario)).cuerpo;
const ultimaId = async () => (await db.ejecutarQuery("SELECT MAX(id_ficha) AS id FROM fichaClinica"))[0].id;

before(async () => {
    // Profesionales de prueba: Ana y Beto con RUT propio; "Clon" comparte el RUT de Ana (datos malos).
    const crear = async (nombre, rut) => (await db.ejecutarQuery(
        "INSERT INTO profesionales (nombreProfesional, descripcionProfesional, correoContacto, numeroTelefono, rutProfesional, estado_Profesional) VALUES (?, 'Prueba', 'p@prueba.cl', '+56900000000', ?, 1)",
        [nombre, rut])).insertId;
    USUARIOS.ana.idProfesional = await crear("Ana Prueba", "111111111");
    USUARIOS.beto.idProfesional = await crear("Beto Prueba", "222222222");
    USUARIOS.clon.idProfesional = await crear("Clon Prueba", "111111111");
    const app = express();
    app.use(express.json());
    app.use("/ficha", rutas);
    await new Promise((r) => { servidor = app.listen(0, "127.0.0.1", r); });
    base = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
    if (servidor) await new Promise((r) => servidor.close(r));
    await db.cerrarConexion();
    DataBase.instance = null;
});

let fichaAna, fichaBeto;
test("crear: el servidor fija como autor al profesional de la sesión (no se crean fichas a nombre de otro)", async () => {
    assert.equal((await post("/ficha/insertarFichaClinica", ficha({ observaciones: "Beto Prueba · RUT: 22.222.222-2" }), "ana")).status, 200);
    fichaAna = await ultimaId();
    const [f] = await db.ejecutarQuery("SELECT observaciones FROM fichaClinica WHERE id_ficha = ?", [fichaAna]);
    assert.equal(f.observaciones, "Ana Prueba · RUT: 11.111.111-1", "aunque mandó el nombre de Beto");
    assert.equal((await post("/ficha/insertarFichaClinica", ficha(), "beto")).status, 200);
    fichaBeto = await ultimaId();
    assert.equal((await post("/ficha/insertarFichaClinica", ficha(), "recepcion")).status, 403);
});

test("carpeta del paciente: cada profesional ve solo las suyas; la administración, todas; recepción, ninguna", async () => {
    const deAna = await fichasDe("ana");
    assert.ok(deAna.some((f) => f.id_ficha === fichaAna));
    assert.ok(!deAna.some((f) => f.id_ficha === fichaBeto), "Ana no ve la de Beto");
    assert.ok(deAna.every((f) => f.observaciones.includes("RUT: 11.111.111-1")));
    const deBeto = await fichasDe("beto");
    assert.deepEqual(deBeto.map((f) => f.id_ficha), [fichaBeto]);
    const deAdmin = await fichasDe("admin");
    assert.ok(deAdmin.some((f) => f.id_ficha === fichaAna) && deAdmin.some((f) => f.id_ficha === fichaBeto));
    assert.ok(deAdmin.length > deAna.length + deBeto.length - 1, "la administración también ve las antiguas del dump");
    assert.deepEqual(await fichasDe("recepcion"), []);
});

test("RUT compartido (datos malos): el nombre desempata y nadie ve la ficha de otro", async () => {
    assert.ok(!(await fichasDe("clon")).some((f) => f.id_ficha === fichaAna), "Clon comparte RUT con Ana pero no es Ana");
});

test("por id: una ficha ajena responde 403", async () => {
    assert.equal((await post("/ficha/seleccionarFichaID", { id_ficha: fichaBeto }, "ana")).status, 403);
    assert.equal((await post("/ficha/seleccionarFichaEspecificaPorId", { id_paciente: ID_PACIENTE, id_ficha: fichaBeto }, "ana")).status, 403);
    assert.equal((await post("/ficha/seleccionarFichaID", { id_ficha: fichaBeto }, "beto")).status, 200);
    assert.equal((await post("/ficha/seleccionarFichaID", { id_ficha: fichaBeto }, "admin")).status, 200);
});

test("todas las fichas del centro: solo la administración", async () => {
    const r = await fetch(`${base}/ficha/seleccionarTodasLasFichas`, { headers: { "X-Prueba-Usuario": "ana" } });
    assert.equal(r.status, 403);
});

test("la ficha no se modifica después de creada (tampoco la administración)", async () => {
    for (const u of ["ana", "admin"]) {
        assert.deepEqual((await post("/ficha/editarFichaPaciente", { id_ficha: fichaAna, motivoConsulta: "cambiado" }, u)).cuerpo, { message: "fichaInmodificable" });
    }
    const [f] = await db.ejecutarQuery("SELECT motivoConsulta FROM fichaClinica WHERE id_ficha = ?", [fichaAna]);
    assert.equal(f.motivoConsulta, "Control");
});

test("dar de baja: solo la administración", async () => {
    assert.equal((await post("/ficha/eliminarFichaClinica", { id_ficha: fichaBeto }, "beto")).status, 403);
    assert.equal((await post("/ficha/eliminarFichaClinica", { id_ficha: fichaBeto }, "admin")).status, 200);
});
