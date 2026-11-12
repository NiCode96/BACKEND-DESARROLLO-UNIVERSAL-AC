// Los correos de la cita llevan el .ics: paciente (confirmación y cambio de hora),
// profesional (confirmación y cambio de hora) y equipo. Brevo y la base se SIMULAN:
// no sale ningún correo.
// Correr con: node --experimental-test-module-mocks --test pruebas/reservas/correoIcs.e2e.mjs
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";

process.env.BREVO_API_KEY = "prueba";
process.env.CORREO_REMITENTE = "no-responder@prueba.cl";
process.env.URL_PUBLICA_SITIO = "https://desarrollo.agendaclinicas.cl";
process.env.RESERVA_TOKEN_SECRET ||= "secreto-de-prueba-0123456789abcdef0123456789";

mock.module("../../services/datosEmpresaConfig.js", {
    namedExports: { obtenerDatosEmpresaConfig: async () => ({ nombreEmpresa: "Clínica Salud Mujer", direccionEmpresa: "Orompello 470, Chillán", correoEmpresa: "", telefonoEmpresa: "", whatsappEmpresa: "", frontUrl: "" }) },
});
mock.module("../../model/ConsentimientoAceptacion.js", { defaultExport: class { async codigoPrivacidadPorReserva() { return null; } } });

const enviados = [];
const fetchReal = globalThis.fetch;
before(() => {
    globalThis.fetch = async (url, opciones) => {
        if (String(url).includes("api.brevo.com")) { enviados.push(JSON.parse(opciones.body)); return new Response("{}", { status: 201 }); }
        throw new Error(`Pedido inesperado en la prueba: ${url}`);
    };
});
after(() => { globalThis.fetch = fetchReal; });

const { default: NotificacionAgendamiento } = await import("../../services/notificacionAgendamiento.js");
const { default: enviarCorreoProfesionales } = await import("../../services/correoNotificacionProfesionales.js");
const { default: enviarCorreoProfesionalesActualizacion } = await import("../../services/correoActualizacionProfesional.js");

const ics = (correo) => {
    const adjunto = correo.attachment?.find((a) => a.name === "cita.ics");
    return adjunto ? Buffer.from(adjunto.content, "base64").toString("utf-8").replace(/\r\n /g, "") : null;
};
const reserva = {
    nombreProfesional: "Dra. María José Pizarro", nombrePaciente: "Lucía", apellidoPaciente: "Fernández", rut: "191695879",
    telefono: "+56911112222", fechaInicio: "2026-11-12", horaInicio: "09:00:00", fechaFinalizacion: "2026-11-12", horaFinalizacion: "09:50:00",
    monto_reserva: 10000, motivo_reserva: "Control post-operatorio", estadoReserva: "reservada", id_reserva: 123,
};

test("confirmación al paciente: .ics sin su nombre ni el motivo", async () => {
    await NotificacionAgendamiento.enviarCorreoConfirmacionReserva({ ...reserva, to: "lucia@ejemplo.cl" });
    const correo = enviados.at(-1);
    assert.equal(correo.to[0].email, "lucia@ejemplo.cl");
    const archivo = ics(correo);
    assert.ok(archivo, "lleva el .ics");
    assert.match(archivo, /SUMMARY:Cita con Dra\. María José Pizarro/);
    assert.match(archivo, /DTSTART:20261112T120000Z/);
    assert.ok(!/Lucía|Fernández|post-operatorio/.test(archivo));
});

test("confirmación al profesional: ahora también lleva el .ics", async () => {
    await enviarCorreoProfesionales("pizarro@ejemplo.cl", "Dra. María José Pizarro", "Lucía Fernández", "2026-11-12", "09:00:00",
        { id_reserva: 123, nombrePaciente: "Lucía", apellidoPaciente: "Fernández", fechaFinalizacion: "2026-11-12", horaFinalizacion: "09:50:00" });
    const correo = enviados.at(-1);
    assert.equal(correo.to[0].email, "pizarro@ejemplo.cl");
    const archivo = ics(correo);
    assert.match(archivo, /SUMMARY:Atención: Lucía F\./);
    assert.match(archivo, /UID:cita-123-equipo@desarrollo\.agendaclinicas\.cl/);
    assert.match(archivo, /DTEND:20261112T125000Z/);
    assert.match(archivo, /TRIGGER:-PT30M/);
    assert.ok(!/191695879|post-operatorio/.test(archivo));
});

test("cambio de hora al profesional: mismo evento con versión mayor", async () => {
    await enviarCorreoProfesionalesActualizacion("pizarro@ejemplo.cl", "Dra. María José Pizarro", "Lucía Fernández", "2026-11-12", "10:00:00",
        { id_reserva: 123, nombrePaciente: "Lucía", apellidoPaciente: "Fernández", fechaFinalizacion: "2026-11-12", horaFinalizacion: "10:50:00" });
    const archivo = ics(enviados.at(-1));
    assert.match(archivo, /UID:cita-123-equipo@desarrollo\.agendaclinicas\.cl/);
    assert.match(archivo, /DTSTART:20261112T130000Z/);
});

test("sin datos de la cita (llamadas antiguas) el correo al profesional sale igual, sin adjunto", async () => {
    await enviarCorreoProfesionales("pizarro@ejemplo.cl", "Dra. María José Pizarro", "Lucía Fernández", "2026-11-12", "09:00:00");
    const correo = enviados.at(-1);
    assert.equal(correo.attachment, undefined);
    assert.match(correo.textContent, /Nueva reserva asignada/);
});

test("cambio de hora al paciente: también lleva el .ics", async () => {
    await NotificacionAgendamiento.enviarCorreoActualizacionReserva({ ...reserva, to: "lucia@ejemplo.cl", horaInicio: "10:00:00", horaFinalizacion: "10:50:00" });
    const archivo = ics(enviados.at(-1));
    assert.match(archivo, /UID:cita-123@desarrollo\.agendaclinicas\.cl/);
    assert.match(archivo, /DTSTART:20261112T130000Z/);
});
