// Archivo de calendario (.ics) de la cita: hora exacta en cualquier huso, formato RFC 5545,
// privacidad del paciente y la versión del equipo/profesional.
// Correr con: npm run test:reservas
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { generarICS, instanteDesdeHoraLocal } from "../../services/icsUtils.js";

process.env.URL_PUBLICA_SITIO = "https://desarrollo.agendaclinicas.cl";
const { adjuntoIcsCita, uidCita } = await import("../../services/icsCita.js");

const leer = (adjunto) => Buffer.from(adjunto.content, "base64").toString("utf-8");
const desplegar = (ics) => ics.replace(/\r\n /g, "");
const campo = (ics, nombre) => desplegar(ics).split("\r\n").find((l) => l.startsWith(nombre + ":"))?.slice(nombre.length + 1);
const AHORA = new Date("2026-11-11T15:00:00Z");
const cita = {
    id_reserva: 123, nombreProfesional: "Dra. María José Pizarro", nombrePaciente: "Lucía", apellidoPaciente: "Fernández",
    nombreClinica: "Clínica Salud Mujer", direccion: "Orompello 470, Oficina 75, Chillán",
    fechaInicio: "2026-11-12", horaInicio: "09:00:00", fechaFinalizacion: "2026-11-12", horaFinalizacion: "09:50:00", ahora: AHORA,
};

test("hora de Chile → instante UTC, en verano, invierno y en los dos cambios de horario de 2026", () => {
    const casos = [
        ["2026-11-12T09:00", "2026-11-12T12:00:00.000Z"], // verano, UTC-3
        ["2026-07-15T09:00", "2026-07-15T13:00:00.000Z"], // invierno, UTC-4
        ["2026-04-04T10:00", "2026-04-04T13:00:00.000Z"], // sábado antes de pasar a invierno
        ["2026-04-06T10:00", "2026-04-06T14:00:00.000Z"], // lunes después
        ["2026-09-05T10:00", "2026-09-05T14:00:00.000Z"], // sábado antes de pasar a verano
        ["2026-09-07T10:00", "2026-09-07T13:00:00.000Z"], // lunes después
        ["2026-12-31T23:30", "2027-01-01T02:30:00.000Z"], // cambio de año
        ["2028-02-29T20:00", "2028-02-29T23:00:00.000Z"], // 29 de febrero
    ];
    for (const [local, utc] of casos) assert.equal(instanteDesdeHoraLocal(local).toISOString(), utc, local);
});

test("el archivo es idéntico con el servidor en cualquier huso", () => {
    const modulo = fileURLToPath(new URL("../../services/icsUtils.js", import.meta.url));
    const script = `import("${modulo}").then(m => process.stdout.write(m.generarICS({ uid: "u", titulo: "Cita", fechaInicio: "2026-07-15T09:00:00", fechaFin: "2026-07-15T09:50:00", secuencia: 1, ahora: new Date("2026-07-01T00:00:00Z") })))`;
    const salidas = ["America/Santiago", "UTC", "Asia/Tokyo", "Pacific/Niue"].map((TZ) =>
        execFileSync(process.execPath, ["--input-type=module", "-e", script], { env: { ...process.env, TZ } }).toString());
    assert.ok(salidas.every((s) => s === salidas[0]), "mismo resultado en los 4 husos");
    assert.equal(campo(salidas[0], "DTSTART"), "20260715T130000Z");
    assert.equal(campo(salidas[0], "DTEND"), "20260715T135000Z");
    assert.equal(campo(salidas[0], "DTSTAMP"), "20260701T000000Z");
});

test("formato RFC 5545: CRLF, líneas de máximo 75 octetos (con tildes) y texto escapado", () => {
    const ics = generarICS({
        uid: "u", titulo: "Atención; revisión, ñandú", descripcion: "Línea uno\nLínea dos, con acentos áéíóú ".repeat(4),
        fechaInicio: "2026-11-12T09:00", fechaFin: "2026-11-12T09:50", secuencia: 3, ahora: AHORA,
    });
    assert.ok(ics.endsWith("\r\n") && !/[^\r]\n/.test(ics), "todas las líneas terminan en CRLF");
    for (const linea of ics.split("\r\n")) assert.ok(Buffer.byteLength(linea) <= 75, `línea de ${Buffer.byteLength(linea)} octetos`);
    assert.equal(campo(ics, "SUMMARY"), "Atención\; revisión\\, ñandú");
    assert.ok(campo(ics, "DESCRIPTION").startsWith("Línea uno\\nLínea dos\\, con acentos áéíóú "), "los pliegues no rompen caracteres");
    for (const linea of ["METHOD:PUBLISH", "STATUS:CONFIRMED", "SEQUENCE:3", "BEGIN:VEVENT", "END:VCALENDAR"]) assert.ok(ics.includes(linea), linea);
});

test("paciente: con quién, dónde y cuándo; sin su nombre ni el motivo", () => {
    const ics = desplegar(leer(adjuntoIcsCita({ ...cita, para: "paciente" })));
    assert.equal(campo(ics, "SUMMARY"), "Cita con Dra. María José Pizarro");
    assert.equal(campo(ics, "LOCATION"), "Orompello 470\\, Oficina 75\\, Chillán");
    assert.equal(campo(ics, "DTSTART"), "20261112T120000Z");
    assert.equal(campo(ics, "UID"), "cita-123@desarrollo.agendaclinicas.cl");
    for (const dato of ["Lucía", "Fernández", "Motivo", "Paciente:"]) assert.ok(!ics.includes(dato), `no incluye ${dato}`);
    assert.deepEqual(ics.match(/TRIGGER:[^\r]+/g), ["TRIGGER:-P1D", "TRIGGER:-PT1H"], "recordatorio 1 día y 1 hora antes");
});

test("profesional y equipo: nombre con inicial y enlace a la reserva, sin RUT ni motivo", () => {
    const ics = desplegar(leer(adjuntoIcsCita({ ...cita, para: "equipo" })));
    assert.equal(campo(ics, "SUMMARY"), "Atención: Lucía F.");
    assert.match(campo(ics, "DESCRIPTION"), /Reserva N° 123 en Clínica Salud Mujer con Dra\. María José Pizarro\./);
    assert.match(campo(ics, "DESCRIPTION"), /https:\/\/desarrollo\.agendaclinicas\.cl\/dashboard\/calendario\?id_reserva=123/);
    assert.ok(!ics.includes("Fernández") && !ics.includes("Motivo"));
    assert.equal(campo(ics, "UID"), "cita-123-equipo@desarrollo.agendaclinicas.cl");
    assert.deepEqual(ics.match(/TRIGGER:[^\r]+/g), ["TRIGGER:-PT30M"]);
});

test("un cambio de hora sube la versión del mismo evento (actualiza en vez de duplicar)", () => {
    const antes = desplegar(leer(adjuntoIcsCita({ ...cita, ahora: new Date("2026-11-11T15:00:00Z") })));
    const despues = desplegar(leer(adjuntoIcsCita({ ...cita, horaInicio: "10:00", horaFinalizacion: "10:50", ahora: new Date("2026-11-11T16:00:00Z") })));
    assert.equal(campo(antes, "UID"), campo(despues, "UID"));
    assert.ok(Number(campo(despues, "SEQUENCE")) > Number(campo(antes, "SEQUENCE")));
    assert.equal(campo(despues, "DTSTART"), "20261112T130000Z");
});

test("datos que llegan de la base o incompletos", () => {
    const conDate = desplegar(leer(adjuntoIcsCita({ ...cita, fechaInicio: new Date(2026, 6, 15), fechaFinalizacion: new Date(2026, 6, 15) })));
    assert.equal(campo(conDate, "DTSTART"), "20260715T130000Z", "fecha como Date (columna DATE)");
    const finAntes = desplegar(leer(adjuntoIcsCita({ ...cita, horaFinalizacion: "08:00" })));
    assert.equal(campo(finAntes, "DTEND"), campo(finAntes, "DTSTART"), "un fin anterior al inicio no deja un evento al revés");
    assert.equal(adjuntoIcsCita({ ...cita, id_reserva: undefined }), null);
    assert.equal(adjuntoIcsCita({ ...cita, fechaInicio: "" }), null);
    assert.equal(adjuntoIcsCita({ ...cita, fechaInicio: "no es fecha" }), null, "nunca lanza");
    assert.equal(uidCita(5), "cita-5@desarrollo.agendaclinicas.cl");
});
