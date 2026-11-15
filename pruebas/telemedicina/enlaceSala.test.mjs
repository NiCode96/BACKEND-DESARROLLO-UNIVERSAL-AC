/*
    Reglas del enlace de la videoconsulta: 15 minutos por envío, un paciente por enlace,
    vuelve con su llave si se le corta, y "finalizó" cuando el profesional sale.

    HTTP → router y controlador reales. Clerk y Twilio se SIMULAN (sin base de datos):
      node --experimental-test-module-mocks --test pruebas/telemedicina/enlaceSala.test.mjs
*/
import assert from "node:assert/strict";
import { after, before, beforeEach, mock, test } from "node:test";
import express from "express";

process.env.TWILIO_ACCOUNT_SID = `AC${"0".repeat(32)}`;
process.env.TWILIO_API_KEY = `SK${"0".repeat(32)}`;
process.env.TWILIO_API_SECRET = "secreto-de-prueba-para-invitaciones";

const USUARIOS = {
    profesional: { clerkId: "user_tele_prof", rol: "profesional-medico", nombre: "Dra. Prueba", idProfesional: 46 },
    otroProfesional: { clerkId: "user_tele_otro", rol: "profesional-medico", nombre: "Dr. Otro", idProfesional: 47 },
    admin: { clerkId: "user_tele_admin", rol: "admin-clinica", nombre: "Admin", idProfesional: null },
    recepcion: { clerkId: "user_tele_recep", rol: "recepcion", nombre: "Recepción", idProfesional: null },
};
mock.module("../../middleware/exigirUsuarioClerk.js", {
    namedExports: {
        exigirUsuarioClerk: (req, res, next) => {
            req.usuario = USUARIOS[req.get("x-prueba-usuario")];
            return req.usuario ? next() : res.status(401).json({ message: "noAutorizado" });
        },
    },
});

// Twilio Video simulado: salas con estado y participantes (conectados o ya no).
const salas = new Map();
let twilioCaido = false;
const errorTwilio = (status) => Object.assign(new Error(`twilio ${status}`), { status });
const { default: twilioReal } = await import("twilio");
function twilioFalso() {
    const rooms = (sid) => ({
        fetch: async () => {
            if (twilioCaido) throw errorTwilio(503);
            if (!salas.has(sid)) throw errorTwilio(404);
            return salas.get(sid);
        },
        update: async ({ status }) => {
            const sala = salas.get(sid);
            if (!sala) throw errorTwilio(404);
            if (sala.status !== "in-progress") throw errorTwilio(400);
            sala.status = status;
            sala.participantes.forEach((p) => { p.status = "disconnected"; });
        },
        participants: {
            list: async ({ status }) => (salas.get(sid)?.participantes ?? []).filter((p) => p.status === status),
        },
    });
    rooms.create = async (opciones) => {
        const sid = `RM${String(salas.size + 1).padStart(32, "0")}`;
        salas.set(sid, { sid, uniqueName: opciones.uniqueName, status: "in-progress", type: opciones.type, opciones, participantes: [] });
        return salas.get(sid);
    };
    return { video: { v1: { rooms } } };
}
twilioFalso.jwt = twilioReal.jwt;
mock.module("twilio", { defaultExport: twilioFalso });

const { default: telemedicinaRoutes } = await import("../../view/telemedicinaRoutes.js");

let servidor, base, ipPrueba = 0;
before(async () => {
    const app = express();
    app.set("trust proxy", 1);
    app.use(express.json());
    app.use("/telemedicina", telemedicinaRoutes);
    servidor = app.listen(0);
    await new Promise((r) => servidor.once("listening", r));
    base = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => servidor?.close());
// Cada prueba con una IP distinta: el límite por IP se prueba aparte.
beforeEach(() => { ipPrueba += 1; });

const ahoraReal = Date.now;
const adelantarMinutos = (minutos) => { const desde = Date.now(); Date.now = () => desde + minutos * 60 * 1000; };
const restaurarReloj = () => { Date.now = ahoraReal; };

async function llamar(ruta, cuerpo, usuario) {
    const headers = { "Content-Type": "application/json", "X-Forwarded-For": `10.0.0.${ipPrueba}` };
    if (usuario) headers["X-Prueba-Usuario"] = usuario;
    const r = await fetch(`${base}/telemedicina/${ruta}`, { method: "POST", headers, body: JSON.stringify(cuerpo) });
    return { status: r.status, cuerpo: await r.json().catch(() => null) };
}
const datosToken = (jwt) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));

async function crearSala(usuario = "profesional") {
    const r = await llamar("nuevaSala", { nombreProfesional: "Dra. Prueba" }, usuario);
    assert.equal(r.status, 200);
    return r.cuerpo.data;
}
/** El paciente pide acceso y, si lo obtiene, "entra" a la sala simulada. */
async function entrarPaciente(sala, invitacion, llave) {
    const r = await llamar("tokenSala", { nombreSala: sala.nombreSala, invitacion, llave });
    if (r.status === 200) {
        const identidad = datosToken(r.cuerpo.data.token).grants.identity;
        const salaTwilio = salas.get(sala.idSala);
        const previo = salaTwilio.participantes.find((p) => p.identity === identidad);
        if (previo) previo.status = "connected";
        else salaTwilio.participantes.push({ identity: identidad, status: "connected" });
    }
    return r;
}
const cortarPaciente = (sala) => salas.get(sala.idSala).participantes.forEach((p) => { p.status = "disconnected"; });

test("crear sala: enlace de 15 minutos, sala de 2 personas que se cierra vacía; recepción no puede", async () => {
    const sala = await crearSala();
    const minutos = (sala.expira - Date.now()) / 60000;
    assert.ok(minutos > 14.9 && minutos <= 15, `vence en 15 min (${minutos})`);
    assert.ok(sala.segundosRestantes >= 899 && sala.segundosRestantes <= 900, "segundos que le quedan, para la cuenta regresiva");
    const { opciones } = salas.get(sala.idSala);
    assert.equal(opciones.maxParticipants, 2);
    assert.equal(opciones.emptyRoomTimeout, 5);
    assert.equal(opciones.unusedRoomTimeout, 5);
    const payload = Buffer.from(sala.invitacion.split(".")[0], "base64url").toString("utf8");
    assert.doesNotMatch(payload, /user_tele_prof/, "la invitación no expone el id de Clerk");
    assert.equal((await llamar("nuevaSala", {}, "recepcion")).status, 403);
    assert.equal((await llamar("nuevaSala", {})).status, 401);
});

test("el profesional entra como 'profesional' (nunca con su id de Clerk); otro profesional no puede", async () => {
    const sala = await crearSala();
    const r = await llamar("tokenProfesional", { nombreSala: sala.nombreSala, invitacion: sala.invitacion }, "profesional");
    assert.equal(r.status, 200);
    const token = datosToken(r.cuerpo.data);
    assert.equal(token.grants.identity, "profesional");
    assert.equal(token.grants.video.room, sala.nombreSala, "solo esa sala");
    assert.equal((await llamar("tokenProfesional", { nombreSala: sala.nombreSala, invitacion: sala.invitacion }, "otroProfesional")).status, 403);
    assert.equal((await llamar("tokenProfesional", { nombreSala: sala.nombreSala, invitacion: sala.invitacion }, "admin")).status, 403, "ni un admin que no la creó");
});

test("paciente con enlace vigente entra; el mismo enlace en otro navegador → enlaceUsado", async () => {
    const sala = await crearSala();
    const r = await entrarPaciente(sala, sala.invitacion);
    assert.equal(r.status, 200);
    assert.match(datosToken(r.cuerpo.data.token).grants.identity, /^paciente-/);
    assert.equal(datosToken(r.cuerpo.data.token).grants.video.room, sala.nombreSala);
    assert.ok(r.cuerpo.data.llave);
    const reenviado = await entrarPaciente(sala, sala.invitacion);
    assert.equal(reenviado.status, 409);
    assert.equal(reenviado.cuerpo.message, "enlaceUsado");
    // Aunque el paciente se haya desconectado, el enlace sigue usado para otra persona.
    cortarPaciente(sala);
    assert.equal((await entrarPaciente(sala, sala.invitacion)).cuerpo.message, "enlaceUsado");
});

test("se le corta al paciente: vuelve con su llave aunque hayan pasado los 15 minutos", async () => {
    const sala = await crearSala();
    const { cuerpo } = await entrarPaciente(sala, sala.invitacion);
    const identidad = datosToken(cuerpo.data.token).grants.identity;
    cortarPaciente(sala);
    adelantarMinutos(30);
    try {
        const r = await entrarPaciente(sala, sala.invitacion, cuerpo.data.llave);
        assert.equal(r.status, 200);
        assert.equal(datosToken(r.cuerpo.data.token).grants.identity, identidad, "misma persona");
        // Llave alterada o de otra persona: no pasa.
        const alterada = cuerpo.data.llave.slice(0, -3) + "abc";
        assert.notEqual((await entrarPaciente(sala, sala.invitacion, alterada)).status, 200);
        const inventada = `paciente-${"f".repeat(12)}-${"a".repeat(12)}.xxxx`;
        assert.notEqual((await entrarPaciente(sala, sala.invitacion, inventada)).status, 200);
    } finally {
        restaurarReloj();
    }
});

test("la llave de otra sala no sirve", async () => {
    const salaA = await crearSala();
    const salaB = await crearSala();
    const { cuerpo } = await entrarPaciente(salaA, salaA.invitacion);
    adelantarMinutos(20);
    try {
        const r = await entrarPaciente(salaB, salaB.invitacion, cuerpo.data.llave);
        assert.equal(r.cuerpo.message, "enlaceVencido");
    } finally {
        restaurarReloj();
    }
});

test("enlace sin usar a los 15 minutos → enlaceVencido; reenviar da uno nuevo con 15 minutos nuevos", async () => {
    const sala = await crearSala();
    adelantarMinutos(15.1);
    try {
        const vencido = await entrarPaciente(sala, sala.invitacion);
        assert.equal(vencido.status, 410);
        assert.equal(vencido.cuerpo.message, "enlaceVencido");

        const renovado = await llamar("renovarInvitacion", { nombreSala: sala.nombreSala, invitacion: sala.invitacion }, "profesional");
        assert.equal(renovado.status, 200);
        assert.notEqual(renovado.cuerpo.invitacion, sala.invitacion);
        const minutos = (renovado.cuerpo.expira - Date.now()) / 60000;
        assert.ok(minutos > 14.9 && minutos <= 15, `15 minutos desde el reenvío (${minutos})`);

        assert.equal((await entrarPaciente(sala, renovado.cuerpo.invitacion)).status, 200);
        assert.equal((await entrarPaciente(sala, sala.invitacion)).cuerpo.message, "enlaceVencido", "el viejo sigue vencido");
    } finally {
        restaurarReloj();
    }
});

test("reenviar con un enlace ya usado: el enlace nuevo deja entrar a una persona más (paciente que cambió de navegador)", async () => {
    const sala = await crearSala();
    await entrarPaciente(sala, sala.invitacion);
    cortarPaciente(sala);
    const renovado = await llamar("renovarInvitacion", { nombreSala: sala.nombreSala, invitacion: sala.invitacion }, "profesional");
    assert.equal((await entrarPaciente(sala, renovado.cuerpo.invitacion)).status, 200);
    assert.equal((await entrarPaciente(sala, renovado.cuerpo.invitacion)).cuerpo.message, "enlaceUsado");
});

test("solo quien creó la sala la reenvía o la cierra", async () => {
    const sala = await crearSala();
    const cuerpo = { nombreSala: sala.nombreSala, invitacion: sala.invitacion };
    for (const usuario of ["otroProfesional", "admin", "recepcion"]) {
        assert.equal((await llamar("renovarInvitacion", cuerpo, usuario)).status, 403, usuario);
        assert.equal((await llamar("finalizarSala", cuerpo, usuario)).status, 403, usuario);
    }
    assert.equal((await llamar("finalizarSala", cuerpo)).status, 401);
    assert.equal(salas.get(sala.idSala).status, "in-progress");
});

test("'Salir' del profesional: la sala termina y ningún enlace vuelve a servir → salaFinalizada", async () => {
    const sala = await crearSala();
    const { cuerpo: entrada } = await entrarPaciente(sala, sala.invitacion);
    const renovado = await llamar("renovarInvitacion", { nombreSala: sala.nombreSala, invitacion: sala.invitacion }, "profesional");

    const r = await llamar("finalizarSala", { nombreSala: sala.nombreSala, invitacion: sala.invitacion }, "profesional");
    assert.equal(r.status, 200);
    assert.equal(salas.get(sala.idSala).status, "completed");
    assert.ok(salas.get(sala.idSala).participantes.every((p) => p.status === "disconnected"), "Twilio saca a todos");

    for (const intento of [
        await entrarPaciente(sala, sala.invitacion, entrada.data.llave),
        await entrarPaciente(sala, renovado.cuerpo.invitacion),
    ]) {
        assert.equal(intento.status, 410);
        assert.equal(intento.cuerpo.message, "salaFinalizada");
    }
    const cuerpo = { nombreSala: sala.nombreSala, invitacion: sala.invitacion };
    assert.equal((await llamar("tokenProfesional", cuerpo, "profesional")).cuerpo.message, "salaFinalizada");
    assert.equal((await llamar("renovarInvitacion", cuerpo, "profesional")).cuerpo.message, "salaFinalizada");
    assert.equal((await llamar("finalizarSala", cuerpo, "profesional")).status, 200, "cerrar dos veces no falla");
});

test("sala que Twilio cerró sola (vacía o 45 min) → salaFinalizada", async () => {
    const sala = await crearSala();
    salas.get(sala.idSala).status = "completed";
    assert.equal((await entrarPaciente(sala, sala.invitacion)).cuerpo.message, "salaFinalizada");
    salas.delete(sala.idSala);
    assert.equal((await entrarPaciente(sala, sala.invitacion)).cuerpo.message, "salaFinalizada");
});

test("invitación alterada, de otra sala o mal formada → no entra", async () => {
    const sala = await crearSala();
    const otra = await crearSala();
    const [payload, firma] = sala.invitacion.split(".");
    const datos = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const alargada = Buffer.from(JSON.stringify({ ...datos, expira: Date.now() + 9e9 })).toString("base64url");
    assert.equal((await entrarPaciente(sala, `${alargada}.${firma}`)).cuerpo.message, "invitacionInvalida");
    assert.equal((await entrarPaciente(sala, otra.invitacion)).cuerpo.message, "invitacionInvalida");
    assert.equal((await entrarPaciente(sala, "basura")).cuerpo.message, "invitacionInvalida");
    assert.equal((await llamar("tokenSala", { nombreSala: "../otra", invitacion: sala.invitacion })).status, 400);
    assert.equal((await llamar("tokenSala", { nombreSala: sala.nombreSala })).status, 400);
    // El cliente ya no elige su identidad: se ignora la que mande.
    const r = await llamar("tokenSala", { nombreSala: sala.nombreSala, invitacion: sala.invitacion, identity: "profesional" });
    assert.match(datosToken(r.cuerpo.data.token).grants.identity, /^paciente-/);
});

test("Twilio caído → 500 sin detalles", async () => {
    const sala = await crearSala();
    twilioCaido = true;
    const r = await entrarPaciente(sala, sala.invitacion);
    twilioCaido = false;
    assert.equal(r.status, 500);
    assert.equal(r.cuerpo.message, "serverError");
});

test("límite: 30 pedidos de acceso cada 10 minutos por IP", async () => {
    const sala = await crearSala();
    let ultimo;
    for (let i = 0; i < 31; i++) ultimo = await llamar("tokenSala", { nombreSala: sala.nombreSala, invitacion: "x.y" });
    assert.equal(ultimo.status, 429);
});
