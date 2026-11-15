/*
    Enviar el enlace de la videoconsulta al correo de la ficha del paciente.

    HTTP → router y controlador reales → MySQL. Clerk, Twilio y Brevo se SIMULAN.
    Requiere una base de PRUEBA con el dump y las migraciones:
      DB_HOST=127.0.0.1 DB_PORT=3307 DB_USER=prueba DB_PASS=prueba DB_DATABASE=ac_tele \
        node --experimental-test-module-mocks --test pruebas/telemedicina/enviarInvitacion.e2e.mjs
*/
import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";
import express from "express";

if (!process.env.DB_DATABASE || /produccion/i.test(process.env.DB_DATABASE)) {
    console.error("Configura DB_* con una base de PRUEBA."); process.exit(1);
}
process.env.TWILIO_API_SECRET = "secreto-de-prueba-para-invitaciones";
process.env.URL_PUBLICA_SITIO = "https://clinica.prueba.cl/";

const USUARIOS = {
    profesional: { clerkId: "user_tele_prof", rol: "profesional-medico", nombre: "Dra. Prueba", idProfesional: 46 },
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
const correos = [];
let brevoFalla = false;
const correoReal = await import("../../services/firma/correoFirma.js");
mock.module("../../services/firma/correoFirma.js", {
    namedExports: { ...correoReal, enviarCorreo: async (c) => { if (brevoFalla) return false; correos.push(c); return true; } },
});
// Twilio: solo importa si la sala sigue en curso.
const salasTerminadas = new Set();
const { default: twilioReal } = await import("twilio");
const twilioFalso = () => ({
    video: { v1: { rooms: (sid) => ({ fetch: async () => ({ sid, status: salasTerminadas.has(sid) ? "completed" : "in-progress" }) }) } },
});
twilioFalso.jwt = twilioReal.jwt;
mock.module("twilio", { defaultExport: twilioFalso });

const { default: DataBase } = await import("../../config/Database.js");
const { default: telemedicinaRoutes } = await import("../../view/telemedicinaRoutes.js");
const { default: TelemedicinaService, huellaCreador } = await import("../../services/telemedicina.js");
const { enmascararCorreo } = await import("../../services/firma/plantillas.js");

const db = DataBase.getInstance();
const servicio = new TelemedicinaService();
const SALA = "telemedicina-11111111-2222-3333-4444-555555555555";
const OTRA_SALA = "telemedicina-99999999-2222-3333-4444-555555555555";
const invitacionDe = (clerkId, { nombreSala = SALA, sid = "RM-sala-en-curso" } = {}) =>
    servicio.generarInvitacion({ nombreSala, sid, nombreProfesional: "Dra. Prueba", creador: huellaCreador(clerkId) });
let ID_CON_CORREO, ID_SIN_CORREO, servidor, base;

before(async () => {
    const [con, sin] = await db.ejecutarQuery("SELECT id_paciente FROM pacienteDatos WHERE estado_paciente <> 0 ORDER BY id_paciente LIMIT 2");
    ID_CON_CORREO = con.id_paciente;
    ID_SIN_CORREO = sin.id_paciente;
    await db.ejecutarQuery("UPDATE pacienteDatos SET correo = 'paciente.ficha@prueba.cl', nombre = 'Juana María' WHERE id_paciente = ?", [ID_CON_CORREO]);
    await db.ejecutarQuery("UPDATE pacienteDatos SET correo = '' WHERE id_paciente = ?", [ID_SIN_CORREO]);

    const app = express();
    app.use(express.json());
    app.use("/telemedicina", telemedicinaRoutes);
    servidor = app.listen(0);
    await new Promise((r) => servidor.once("listening", r));
    base = `http://127.0.0.1:${servidor.address().port}`;
});
after(async () => {
    servidor?.close();
    await db.cerrarConexion();
});

const enviar = async (cuerpo, usuario = "profesional") => {
    const r = await fetch(`${base}/telemedicina/enviarInvitacionCorreo`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Prueba-Usuario": usuario }, body: JSON.stringify(cuerpo),
    });
    return { status: r.status, cuerpo: await r.json().catch(() => null) };
};

test("el profesional envía: llega al correo de la ficha con un enlace NUEVO de 15 minutos, y responde enmascarado", async () => {
    const invitacion = invitacionDe("user_tele_prof");
    const r = await enviar({ id_paciente: ID_CON_CORREO, nombreSala: SALA, invitacion, correo: "atacante@otro.cl" });
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.destino, enmascararCorreo("paciente.ficha@prueba.cl"));
    assert.doesNotMatch(r.cuerpo.destino, /paciente\.ficha/);
    assert.notEqual(r.cuerpo.invitacion, invitacion, "cada envío es un enlace nuevo");
    const minutos = (r.cuerpo.expira - Date.now()) / 60000;
    assert.ok(minutos > 14.9 && minutos <= 15, `15 minutos desde el envío (${minutos})`);
    assert.equal(correos.length, 1);
    const [correo] = correos;
    assert.equal(correo.para, "paciente.ficha@prueba.cl", "siempre el de la ficha, nunca el del cuerpo");
    const enlace = `https://clinica.prueba.cl/telemedicina/${SALA}?i=${r.cuerpo.invitacion}`;
    assert.ok(correo.html.includes(enlace.replace(/&/g, "&amp;")) || correo.html.includes(enlace), "trae el enlace nuevo");
    assert.ok(!correo.html.includes(invitacion), "no el anterior");
    assert.match(correo.html, /Juana/);
    assert.doesNotMatch(correo.html, /María/, "solo el primer nombre");
    assert.match(correo.html, /Dra\. Prueba/);
    assert.match(correo.html, /Para entrar tienes hasta el/);
});

test("administración puede si la sala es suya; recepción no; nadie con la sala de otro", async () => {
    assert.equal((await enviar({ id_paciente: ID_CON_CORREO, nombreSala: SALA, invitacion: invitacionDe("user_tele_admin") }, "admin")).status, 200);
    assert.equal((await enviar({ id_paciente: ID_CON_CORREO, nombreSala: SALA, invitacion: invitacionDe("user_tele_recep") }, "recepcion")).status, 403);
    assert.equal((await enviar({ id_paciente: ID_CON_CORREO, nombreSala: SALA, invitacion: invitacionDe("user_tele_prof") }, "admin")).status, 403);
});

test("invitación de otra sala o alterada → 403; sala terminada → 410; nada se envía", async () => {
    const antes = correos.length;
    const deOtra = invitacionDe("user_tele_prof", { nombreSala: OTRA_SALA });
    assert.equal((await enviar({ id_paciente: ID_CON_CORREO, nombreSala: SALA, invitacion: deOtra })).status, 403);
    const buena = invitacionDe("user_tele_prof");
    assert.equal((await enviar({ id_paciente: ID_CON_CORREO, nombreSala: SALA, invitacion: buena.slice(0, -2) + "xx" })).status, 403);
    salasTerminadas.add("RM-terminada");
    const terminada = await enviar({ id_paciente: ID_CON_CORREO, nombreSala: SALA, invitacion: invitacionDe("user_tele_prof", { sid: "RM-terminada" }) });
    assert.equal(terminada.status, 410);
    assert.equal(terminada.cuerpo.message, "salaFinalizada");
    assert.equal(correos.length, antes);
});

test("un enlace vencido sirve para reenviar (identifica la sala): el correo lleva uno nuevo", async () => {
    const ahora = Date.now;
    Date.now = () => ahora() - 60 * 60 * 1000; // generado hace 1 h
    const vencida = invitacionDe("user_tele_prof");
    Date.now = ahora;
    const r = await enviar({ id_paciente: ID_CON_CORREO, nombreSala: SALA, invitacion: vencida });
    assert.equal(r.status, 200);
    assert.ok(r.cuerpo.expira > Date.now());
});

test("paciente sin correo en la ficha → 422; datos incompletos → 400", async () => {
    const invitacion = invitacionDe("user_tele_prof");
    assert.equal((await enviar({ id_paciente: ID_SIN_CORREO, nombreSala: SALA, invitacion })).cuerpo.message, "sinDatoContacto");
    assert.equal((await enviar({ id_paciente: ID_CON_CORREO, nombreSala: "../otra", invitacion })).status, 400);
    assert.equal((await enviar({ nombreSala: SALA, invitacion })).status, 400);
});

test("si Brevo falla → 503", async () => {
    brevoFalla = true;
    const r = await enviar({ id_paciente: ID_CON_CORREO, nombreSala: SALA, invitacion: invitacionDe("user_tele_admin") }, "admin");
    brevoFalla = false;
    assert.equal(r.status, 503);
});

test("límite: 10 envíos cada 10 minutos por usuario", async () => {
    const invitacion = invitacionDe("user_tele_prof");
    let ultimo;
    // El profesional ya hizo 8 pedidos en las pruebas anteriores.
    for (let i = 0; i < 3; i++) ultimo = await enviar({ id_paciente: ID_CON_CORREO, nombreSala: SALA, invitacion });
    assert.equal(ultimo.status, 429);
});
