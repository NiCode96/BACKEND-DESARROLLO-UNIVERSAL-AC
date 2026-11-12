/*
    Documento de pacientes extranjeros (RUT, pasaporte o DNI) de punta a punta:
    ficha del paciente, reservas del dashboard y de la página pública, y la
    constancia de consentimiento.

    HTTP → routers y controladores reales → MySQL. Clerk, R2, correos y WhatsApp se
    SIMULAN (ningún mensaje sale de esta prueba).

    Requiere una base de PRUEBA con el dump, las migraciones de docs/firma y las de migraciones/:
      DB_HOST=127.0.0.1 DB_PORT=3307 DB_USER=root DB_PASS= DB_DATABASE=ac_doc \
        node --experimental-test-module-mocks --test pruebas/pacientes/documentoExtranjero.e2e.mjs
*/
import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";
import express from "express";

if (!process.env.DB_DATABASE || /produccion/i.test(process.env.DB_DATABASE)) {
    console.error("Configura DB_* con una base de PRUEBA."); process.exit(1);
}
process.env.FIRMA_HMAC_CLAVE ||= "clave-de-prueba-solo-para-tests-0123456789abcdef";
process.env.FIRMA_HMAC_VERSION ||= "1";

const enviados = [];
const anotar = (canal) => async (...args) => { enviados.push({ canal, args }); return { ok: true }; };
mock.module("../../middleware/exigirSesionClerk.js", {
    namedExports: { exigirSesionClerk: (req, res, next) => { req.sesionClerk = { sub: "user_prueba_doc" }; next(); } },
});
mock.module("../../services/notificacionAgendamiento.js", {
    defaultExport: class {
        static enviarCorreoConfirmacionReserva = anotar("correo");
        static enviarCorreoActualizacionReserva = anotar("correo");
        static enviarCorreoConfirmacionEquipo = anotar("correo-equipo");
    },
});
mock.module("../../services/notificacionWhatsApp.js", {
    namedExports: {
        notificacionAgendamiento: anotar("whatsapp"), notificacionActualizacionAgendamiento: anotar("whatsapp"),
        enviarMensajeTextoWhatsApp: anotar("whatsapp"), enviarRecordatorio_1hora: anotar("whatsapp"),
    },
});
mock.module("../../services/correoNotificacionProfesionales.js", { defaultExport: anotar("correo-profesional") });
mock.module("../../services/correoActualizacionProfesional.js", { defaultExport: anotar("correo-profesional") });
const subidas = [];
mock.module("../../services/r2Storage.js", {
    namedExports: {
        construirKey: (id, n) => `pacientes/${id}/${n}`,
        construirKeyPrivada: (carpeta, ext) => `${carpeta}/prueba-${subidas.length + 1}.${ext}`,
        subirArchivo: async (buffer, key, tipo) => { subidas.push({ buffer: Buffer.from(buffer), key, tipo }); },
        eliminarArchivoR2: async () => {},
        generarUrlDescarga: async (key) => `https://r2.prueba/${key}`,
        descargarArchivoComoBuffer: async (key) => subidas.find((s) => s.key === key)?.buffer,
        listarClaves: async () => ({ claves: [] }),
    },
});
const correoReal = await import("../../services/firma/correoFirma.js");
mock.module("../../services/firma/correoFirma.js", { namedExports: { ...correoReal, enviarCorreo: anotar("correo-constancia") } });

const { default: rutasPacientes } = await import("../../view/pacientesRoutes.js");
const { default: rutasReservas } = await import("../../view/reservaPacienteRoutes.js");
const { default: rutasConsentimientos } = await import("../../view/consentimientosRoutes.js");
const { vincularAceptacionConReserva } = await import("../../controller/ConsentimientosController.js");
const { default: DataBase } = await import("../../config/Database.js");
const db = DataBase.getInstance();
let servidor, base, ID_PROFESIONAL;

const post = async (ruta, cuerpo) => {
    const r = await fetch(base + ruta, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer prueba" }, body: JSON.stringify(cuerpo) });
    return { status: r.status, cuerpo: await r.json().catch(() => null) };
};
const paciente = (extra = {}) => ({
    nombre: "Lucía", apellido: "Fernández", rut: "30123456", tipo_documento: "dni", nacimiento: "1990-05-04", sexo: "F", prevision_id: 1,
    telefono: "+56911112222", correo: "lucia@ejemplo.cl", direccion: "Av. Prueba 123", pais: "argentina", ...extra,
});
const filaPaciente = async (rut) => (await db.ejecutarQuery("SELECT id_paciente, rut, tipo_documento FROM pacienteDatos WHERE rut = ?", [rut]))[0];
let diaLibre = 0;
const reserva = (extra = {}) => {
    diaLibre += 1;
    const fecha = `2027-0${1 + Math.floor(diaLibre / 28)}-${String(1 + (diaLibre % 28)).padStart(2, "0")}`;
    return {
        nombrePaciente: "Lucía", apellidoPaciente: "Fernández", rut: "30123456", tipo_documento: "dni", telefono: "+56911112222",
        email: "lucia@ejemplo.cl", fechaInicio: fecha, horaInicio: "10:00", fechaFinalizacion: fecha, horaFinalizacion: "10:30",
        monto_reserva: 1000, motivo_reserva: "Consulta", estadoReserva: "reservada", id_profesional: ID_PROFESIONAL, ...extra,
    };
};
const filaReserva = async (fecha) => (await db.ejecutarQuery(
    "SELECT id_reserva, rut, tipo_documento FROM reservaPacientes WHERE fechaInicio = ? AND id_profesional = ? ORDER BY id_reserva DESC LIMIT 1", [fecha, ID_PROFESIONAL]))[0];

before(async () => {
    [{ id_profesional: ID_PROFESIONAL }] = await db.ejecutarQuery("SELECT id_profesional FROM profesionales WHERE estado_Profesional = 1 ORDER BY id_profesional LIMIT 1");
    const app = express();
    app.set("trust proxy", 1);
    app.use(express.json());
    app.use("/pacientes", rutasPacientes);
    app.use("/reservaPacientes", rutasReservas);
    app.use("/consentimientos", rutasConsentimientos);
    await new Promise((r) => { servidor = app.listen(0, "127.0.0.1", r); });
    base = `http://127.0.0.1:${servidor.address().port}`;
});
after(async () => {
    if (servidor) await new Promise((r) => servidor.close(r));
    await db.cerrarConexion();
    DataBase.instance = null;
});

test("ficha: un paciente con DNI queda guardado como DNI (antes quedaba como RUT)", async () => {
    assert.deepEqual((await post("/pacientes/pacientesInsercion", paciente())).cuerpo, { message: true });
    assert.deepEqual({ ...(await filaPaciente("30123456")), id_paciente: undefined }, { id_paciente: undefined, rut: "30123456", tipo_documento: "dni" });
    assert.deepEqual((await post("/pacientes/pacientesInsercion", paciente({ rut: "ab-123 4567", tipo_documento: "pasaporte", correo: "p@ejemplo.cl" }))).cuerpo, { message: true });
    assert.equal((await filaPaciente("AB1234567")).tipo_documento, "pasaporte", "pasaporte guardado limpio");
});

test("ficha: sin tipo (cliente antiguo) sigue siendo RUT; tipo o documento inválido se rechaza", async () => {
    assert.deepEqual((await post("/pacientes/pacientesInsercion", paciente({ rut: "212345601", tipo_documento: undefined }))).cuerpo, { message: true });
    assert.equal((await filaPaciente("212345601")).tipo_documento, "rut");
    assert.deepEqual(await post("/pacientes/pacientesInsercion", paciente({ rut: "99999999", tipo_documento: "cedula" })), { status: 400, cuerpo: { message: "tipo-documento-invalido" } });
    assert.deepEqual(await post("/pacientes/pacientesInsercion", paciente({ rut: "12", tipo_documento: "dni" })), { status: 400, cuerpo: { message: "documento-invalido" } });
});

test("ficha: editar sin tipo conserva el guardado; con tipo lo cambia", async () => {
    const { id_paciente } = await filaPaciente("30123456");
    assert.deepEqual((await post("/pacientes/pacientesActualizar", { ...paciente({ tipo_documento: undefined }), id_paciente })).cuerpo, { message: true });
    assert.equal((await filaPaciente("30123456")).tipo_documento, "dni", "un cliente que no envía el tipo no lo borra");
    assert.deepEqual((await post("/pacientes/pacientesActualizar", { ...paciente({ tipo_documento: "pasaporte" }), id_paciente })).cuerpo, { message: true });
    assert.equal((await filaPaciente("30123456")).tipo_documento, "pasaporte");
    await post("/pacientes/pacientesActualizar", { ...paciente(), id_paciente });
    assert.equal((await filaPaciente("30123456")).tipo_documento, "dni");
});

test("reservas (página pública y dashboard): guardan el tipo; editar sin tipo lo conserva", async () => {
    const publica = reserva();
    assert.equal((await post("/reservaPacientes/insertarReservaPacienteFicha", publica)).status, 200);
    let fila = await filaReserva(publica.fechaInicio);
    assert.deepEqual({ rut: fila.rut, tipo: fila.tipo_documento }, { rut: "30123456", tipo: "dni" });

    const multiple = reserva({ rut: "x9 87654", tipo_documento: "pasaporte" });
    assert.equal((await post("/reservaPacientes/insertarReservasMultiples", multiple)).status, 200);
    assert.deepEqual(await filaReserva(multiple.fechaInicio).then((f) => [f.rut, f.tipo_documento]), ["X987654", "pasaporte"]);

    const { id_reserva, ...resto } = { ...publica, id_reserva: fila.id_reserva };
    assert.equal((await post("/reservaPacientes/actualizarReservacion", { ...resto, id_reserva, tipo_documento: undefined, motivo_reserva: "Control" })).status, 200);
    fila = await filaReserva(publica.fechaInicio);
    assert.equal(fila.tipo_documento, "dni", "el calendario (que no envía el tipo) no lo borra");

    assert.deepEqual(await post("/reservaPacientes/insertarReservaPacienteFicha", reserva({ tipo_documento: "otro" })), { status: 400, cuerpo: { message: "tipo-documento-invalido" } });
    assert.ok(enviados.length > 0 && enviados.every((e) => e.canal), "los avisos se simularon (no salió ninguno)");
});

test("consentimiento: con DNI la constancia dice DNI y queda unido a la ficha del paciente", async () => {
    const plantillas = (await (await fetch(`${base}/consentimientos/seleccionarVigentes`)).json()).plantillas;
    const politica = plantillas.find((p) => p.codigo === "tratamiento_datos");
    const r = await post("/consentimientos/registrarAceptacion", {
        aceptaciones: [{ codigo: politica.codigo, id_plantilla: politica.id_plantilla, version: politica.version, sha256: politica.sha256 }],
        paciente: { nombre: "Lucía", apellido: "Fernández", tipo_documento: "dni", documento: "30.123.456", correo: "lucia@ejemplo.cl", telefono: "+56911112222" },
        id_profesional: ID_PROFESIONAL,
    });
    assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
    const [fila] = await db.ejecutarQuery("SELECT paciente_tipo_documento, paciente_documento, pdf_key FROM consentimiento_aceptacion WHERE token_aceptacion = ?", [r.cuerpo.token_aceptacion]);
    assert.deepEqual([fila.paciente_tipo_documento, fila.paciente_documento], ["dni", "30123456"]);
    const pdf = subidas.find((s) => s.key === fila.pdf_key).buffer.toString("latin1");
    assert.ok(pdf.includes("DNI 30123456"), "la constancia nombra el DNI");
    assert.ok(!pdf.includes("RUT 30123456"), "y no lo llama RUT");

    // Pasaporte con letras: al unir con la reserva encuentra al paciente (antes borraba las letras).
    const r2 = await post("/consentimientos/registrarAceptacion", {
        aceptaciones: [{ codigo: politica.codigo, id_plantilla: politica.id_plantilla, version: politica.version, sha256: politica.sha256 }],
        paciente: { nombre: "Lucía", apellido: "Fernández", tipo_documento: "pasaporte", documento: "AB1234567", correo: "p@ejemplo.cl" },
        id_profesional: ID_PROFESIONAL,
    });
    assert.equal(r2.status, 200, JSON.stringify(r2.cuerpo));
    await vincularAceptacionConReserva(r2.cuerpo.token_aceptacion, null, "AB1234567");
    const [unida] = await db.ejecutarQuery("SELECT id_paciente FROM consentimiento_aceptacion WHERE token_aceptacion = ?", [r2.cuerpo.token_aceptacion]);
    assert.equal(unida.id_paciente, (await filaPaciente("AB1234567")).id_paciente);
});
