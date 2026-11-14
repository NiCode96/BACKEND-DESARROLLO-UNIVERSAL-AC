/*
    Rutas que comparten el sitio público y el dashboard: sin sesión salen SOLO los campos
    públicos (services/camposPublicos.js); con sesión del personal, todo; con un token
    inválido o sin perfil, 401/403 y nunca los datos.

    Routers y controladores reales → MySQL. Clerk se SIMULA.
    Requiere una base de PRUEBA con el dump y las migraciones:
      DB_HOST=127.0.0.1 DB_PORT=3307 DB_USER=prueba DB_PASS=prueba DB_DATABASE=ac_pub \
        node --experimental-test-module-mocks --test pruebas/blindaje/respuestasPublicas.e2e.mjs
*/
import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";
import express from "express";

if (!process.env.DB_DATABASE || /produccion/i.test(process.env.DB_DATABASE)) {
    console.error("Configura DB_* con una base de PRUEBA."); process.exit(1);
}
process.env.CLERK_SECRET_KEY = "sk_test_falsa";

const PERFILES = { tecnico: "tecnico-nativecode", admin: "admin-clinica", recepcion: "recepcion", sinPerfil: undefined };
mock.module("@clerk/backend", {
    namedExports: {
        verifyToken: async (token) => {
            if (!String(token).startsWith("t:")) throw new Error("token inválido");
            return { sub: token.slice(2), sid: "sess_prueba" };
        },
        createClerkClient: () => ({
            users: {
                getUser: async (id) => ({
                    firstName: id, emailAddresses: [],
                    publicMetadata: PERFILES[id] === undefined ? {} : { role: PERFILES[id] },
                }),
            },
        }),
    },
});

const { default: DataBase } = await import("../../config/Database.js");
const { default: profesionalesRoutes } = await import("../../view/profesionalesRoutes.js");
const { default: bloqueoAgendaRoutes } = await import("../../view/bloqueoAgendaRoutes.js");
const { default: resenasRoutes } = await import("../../view/resenasRoutes.js");
const { default: persistenceRoutes } = await import("../../view/mercadoPagoPersistenceRoutes.js");
const { CAMPOS_PUBLICOS } = await import("../../services/camposPublicos.js");

const db = DataBase.getInstance();
const TOKEN_FALSO = "TEST-0000000000-token-de-prueba-que-no-debe-salir";
let ID_PROFESIONAL, servidor, base;

before(async () => {
    [{ id_profesional: ID_PROFESIONAL }] = await db.ejecutarQuery(
        "SELECT id_profesional FROM profesionales WHERE estado_Profesional <> 0 ORDER BY id_profesional LIMIT 1");
    await db.ejecutarQuery("UPDATE profesionales SET rutProfesional = '111111111', correoContacto = 'privado@prueba.cl' WHERE id_profesional = ?", [ID_PROFESIONAL]);
    await db.ejecutarQuery(
        `INSERT INTO bloqueoAgenda (id_profesional, fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion, motivo, estado_bloqueoAgenda)
         VALUES (?, '2026-12-01', '09:00', '2026-12-01', '10:00', 'Motivo interno de prueba', 1)`, [ID_PROFESIONAL]);
    await db.ejecutarQuery(
        "INSERT INTO resenas (rating, comentario, paciente_id, profesional_id, estado, nombre_invitado, apellido_invitado) VALUES (5, 'Muy bien', 123, ?, 1, 'Ana', 'Pérez')",
        [ID_PROFESIONAL]);
    await db.ejecutarQuery("INSERT INTO mercadoPago_persistence (nombre_cliente, access_token, estado_pasarela) VALUES ('Prueba', ?, 1)", [TOKEN_FALSO]);

    const app = express();
    app.use(express.json());
    app.use("/profesionales", profesionalesRoutes);
    app.use("/bloqueoAgenda", bloqueoAgendaRoutes);
    app.use("/resenas", resenasRoutes);
    app.use("/persistence", persistenceRoutes);
    servidor = app.listen(0);
    await new Promise((r) => servidor.once("listening", r));
    base = `http://127.0.0.1:${servidor.address().port}`;
});
after(async () => {
    servidor?.close();
    await db.cerrarConexion();
});

async function pedir(metodo, ruta, { cuerpo, token } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await fetch(`${base}${ruta}`, { method: metodo, headers, ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}) });
    return { status: r.status, texto: await r.text() };
}
const filas = (texto) => { const d = JSON.parse(texto); return Array.isArray(d) ? d : [d]; };
const soloLlaves = (texto, permitidas) => {
    for (const fila of filas(texto)) assert.deepEqual(Object.keys(fila).sort(), [...permitidas].sort());
};

const RUTAS = {
    profesionales: () => pedir("GET", "/profesionales/seleccionarTodosProfesionales"),
    profesional: (o) => pedir("POST", "/profesionales/seleccionarProfesional", { cuerpo: { id_profesional: ID_PROFESIONAL }, ...o }),
    bloqueos: (o) => pedir("POST", "/bloqueoAgenda/seleccionarBloqueosPorProfesional", { cuerpo: { id_profesional: ID_PROFESIONAL }, ...o }),
    resenas: (o) => pedir("POST", "/resenas/seleccionarPorProfesional", { cuerpo: { profesional_id: ID_PROFESIONAL }, ...o }),
    pasarela: (o) => pedir("GET", "/persistence/obtenerPersistencia", o),
};

test("sin sesión: profesionales solo con nombre, descripción, categoría y foto", async () => {
    for (const r of [await RUTAS.profesionales(), await RUTAS.profesional()]) {
        assert.equal(r.status, 200);
        soloLlaves(r.texto, CAMPOS_PUBLICOS.profesional);
        assert.doesNotMatch(r.texto, /111111111|privado@prueba\.cl|usuarioAsignadoClerk|registro_sis/);
    }
});

test("sin sesión: bloqueos sin el motivo", async () => {
    const r = await RUTAS.bloqueos();
    assert.equal(r.status, 200);
    soloLlaves(r.texto, CAMPOS_PUBLICOS.bloqueo);
    assert.doesNotMatch(r.texto, /Motivo interno/);
});

test("sin sesión: reseñas sin paciente_id", async () => {
    const r = await RUTAS.resenas();
    assert.equal(r.status, 200);
    soloLlaves(r.texto, CAMPOS_PUBLICOS.resena);
    assert.ok(filas(r.texto).some((f) => f.nombre_invitado === "Ana"), "la reseña se sigue mostrando");
});

test("sin sesión: pasarela solo dice si está activa, nunca el token", async () => {
    const r = await RUTAS.pasarela();
    assert.equal(r.status, 200);
    soloLlaves(r.texto, CAMPOS_PUBLICOS.pasarela);
    assert.equal(filas(r.texto)[0].estado_pasarela, 1);
    assert.doesNotMatch(r.texto, new RegExp(TOKEN_FALSO));
});

test("sin sesión: las reseñas del inicio se ven, con el paciente como \"Nombre I.\"", async () => {
    const [{ id_paciente, nombre, apellido }] = await db.ejecutarQuery(
        "SELECT id_paciente, nombre, apellido FROM pacienteDatos WHERE nombre <> '' AND apellido <> '' LIMIT 1");
    await db.ejecutarQuery("INSERT INTO resenas (rating, comentario, paciente_id, profesional_id, estado) VALUES (4, 'De paciente', ?, ?, 1)", [id_paciente, ID_PROFESIONAL]);
    const r = await pedir("GET", "/resenas/seleccionarTodas");
    assert.equal(r.status, 200, "antes daba 401 y el inicio quedaba vacío");
    soloLlaves(r.texto, CAMPOS_PUBLICOS.resenaCentro);
    const fila = filas(r.texto).find((f) => f.comentario === "De paciente");
    assert.equal(fila.nombrePaciente, nombre.trim().split(/\s+/)[0]);
    assert.equal(fila.apellidoPaciente, `${apellido.trim()[0].toUpperCase()}.`);
    assert.doesNotMatch(r.texto, /paciente_id/);
    const conSesion = await pedir("GET", "/resenas/seleccionarTodas", { token: "t:admin" });
    assert.match(conSesion.texto, new RegExp(`"apellidoPaciente":"${apellido.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
});

test("publicar sin sesión: se guarda, se ve, y paciente_id se ignora", async () => {
    const r = await pedir("POST", "/resenas/insertarResena", { cuerpo: {
        rating: 5, comentario: "Publicada sin sesión", profesional_id: ID_PROFESIONAL, paciente_id: 1, nombre_invitado: "Rosa", apellido_invitado: "Díaz" } });
    assert.ok(r.status < 300, r.texto);
    const [guardada] = await db.ejecutarQuery("SELECT paciente_id FROM resenas WHERE comentario = 'Publicada sin sesión'");
    assert.equal(guardada.paciente_id, null);
    assert.match((await pedir("GET", "/resenas/seleccionarTodas")).texto, /Publicada sin sesión/);
});

test("con sesión del personal: el dashboard recibe todo", async () => {
    const p = await RUTAS.profesional({ token: "t:recepcion" });
    assert.equal(p.status, 200);
    assert.match(p.texto, /111111111/);
    assert.match((await RUTAS.bloqueos({ token: "t:admin" })).texto, /Motivo interno/);
    assert.match((await RUTAS.resenas({ token: "t:admin" })).texto, /"paciente_id":123/);
});

test("el token de Mercado Pago solo lo ve el técnico", async () => {
    for (const token of ["t:admin", "t:recepcion"]) {
        const r = await RUTAS.pasarela({ token });
        assert.equal(r.status, 200);
        assert.doesNotMatch(r.texto, new RegExp(TOKEN_FALSO), token);
    }
    assert.match((await RUTAS.pasarela({ token: "t:tecnico" })).texto, new RegExp(TOKEN_FALSO));
});

test("token inválido o sin perfil: 401/403, nunca los datos", async () => {
    for (const nombre of ["profesional", "bloqueos", "resenas", "pasarela"]) {
        const invalido = await RUTAS[nombre]({ token: "falso" });
        assert.equal(invalido.status, 401, nombre);
        const sinPerfil = await RUTAS[nombre]({ token: "t:sinPerfil" });
        assert.equal(sinPerfil.status, 403, nombre);
        assert.doesNotMatch(invalido.texto + sinPerfil.texto, /111111111|Motivo interno|paciente_id|TEST-0000/);
    }
});
