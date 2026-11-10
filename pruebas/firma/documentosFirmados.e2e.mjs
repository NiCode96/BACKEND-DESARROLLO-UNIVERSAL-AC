/*
    Fase 7 de docs/firma de punta a punta: documentos con firma electrónica simple.
    Preparar (cuerpo del PDF), firmar (grafía + texto legal + QR, una sola vez),
    descargar, enviar por correo, listar, anular, y el consentimiento informado con
    el código (OTP) del paciente por WhatsApp o correo.

    HTTP → routers y controladores reales → MySQL → pdf-lib/sharp/qrcode.
    Clerk, R2, Twilio y el correo se SIMULAN.

    Requiere una base de PRUEBA con el dump, las migraciones de docs/firma y las de migraciones/:
      DB_HOST=127.0.0.1 DB_PORT=3407 DB_USER=prueba DB_PASS=prueba DB_DATABASE=ac_docs \
        node --experimental-test-module-mocks --test pruebas/firma/documentosFirmados.e2e.mjs
*/
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { after, before, mock, test } from "node:test";
import express from "express";
import sharp from "sharp";
import { PDFDocument, StandardFonts } from "pdf-lib";

if (!process.env.DB_DATABASE || /produccion/i.test(process.env.DB_DATABASE)) {
    console.error("Configura DB_* con una base de PRUEBA."); process.exit(1);
}
process.env.FIRMA_HMAC_CLAVE ||= "clave-de-prueba-solo-para-tests-0123456789abcdef";
process.env.FIRMA_HMAC_VERSION ||= "1";
process.env.URL_PUBLICA_SITIO = "https://desarrollo.agendaclinicas.cl";
Object.assign(process.env, {
    TWILIO_ACCOUNT_SID: "ACprueba", TWILIO_AUTH_TOKEN: "prueba", TWILIO_WHATSAPP_FROM: "+15550001111",
    TWILIO_CONTENT_SID_OTP: "HXprueba_otp",
});

const ID_PROFESIONAL = 46;
const ID_PACIENTE = 2283;
const USUARIOS = {
    duenio: { clerkId: "user_doc_duenio", rol: "profesional-medico", nombre: "Dueña Docs", idProfesional: ID_PROFESIONAL },
    otro: { clerkId: "user_doc_otro", rol: "profesional-medico", nombre: "Otro Docs", idProfesional: 45 },
    admin: { clerkId: "user_doc_admin", rol: "admin-clinica", nombre: "Admin Docs", idProfesional: null },
    recepcion: { clerkId: "user_doc_recep", rol: "recepcion", nombre: "Recepción Docs", idProfesional: null },
};
mock.module("../../middleware/exigirUsuarioClerk.js", {
    namedExports: {
        exigirUsuarioClerk: (req, res, next) => {
            const u = USUARIOS[req.get("x-prueba-usuario")];
            if (!u) return res.status(401).json({ message: "noAutorizado" });
            req.usuario = { ...u, sesionId: "sess_prueba", fva: (req.get("x-prueba-fva") || "1,-1").split(",").map(Number) };
            req.contexto = { ip: "127.0.0.1", userAgent: "Prueba/1.0" };
            return next();
        },
    },
});
const r2 = new Map();
mock.module("../../services/r2Storage.js", {
    namedExports: {
        construirKey: (id, n) => `pacientes/${id}/${n}`,
        construirKeyPrivada: (carpeta, ext) => `${carpeta}/prueba-${r2.size + 1}.${ext}`,
        subirArchivo: async (buffer, key) => { r2.set(key, Buffer.from(buffer)); },
        eliminarArchivoR2: async (key) => { r2.delete(key); },
        generarUrlDescarga: async (key) => `https://r2.prueba/${key}`,
        descargarArchivoComoBuffer: async (key) => r2.get(key),
        listarClaves: async () => ({ claves: [] }),
    },
});
const whatsapps = [];
mock.module("twilio", { defaultExport: () => ({ messages: { create: async (m) => { whatsapps.push(m); return { sid: "SMprueba" }; } } }) });
const correos = [];
const correoReal = await import("../../services/firma/correoFirma.js");
mock.module("../../services/firma/correoFirma.js", {
    namedExports: { ...correoReal, enviarCorreo: async (args) => { correos.push(args); return true; } },
});

const { default: rutasDocumentos } = await import("../../view/documentosRoutes.js");
const { default: rutasFirma } = await import("../../view/firmaProfesionalRoutes.js");
const { default: DataBase } = await import("../../config/Database.js");
const db = DataBase.getInstance();
const sha256 = (b) => createHash("sha256").update(b).digest("hex");

let servidor, base;
const logOriginal = console.error;
const errores = [];

// ── Utilidades ──────────────────────────────────────────────────────────────
async function cuerpoPdf(texto = "Cotización de prueba") {
    const pdf = await PDFDocument.create();
    const pagina = pdf.addPage([612, 792]); // carta
    pagina.drawText(texto, { x: 50, y: 720, size: 14, font: await pdf.embedFont(StandardFonts.Helvetica) });
    return Buffer.from(await pdf.save());
}
const ZONA_FIRMA = { pagina: 1, x: 15, y: 200, ancho: 186, alto: 56 };
const ZONA_PACIENTE = { pagina: 1, x: 15, y: 165, ancho: 186, alto: 26 };

/** Texto dibujado en el PDF: descomprime los content streams y decodifica los <hex> Tj. */
function textoDelPdf(buffer) {
    const bruto = buffer.toString("latin1");
    let texto = "";
    for (const m of bruto.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
        let contenido;
        try { contenido = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1"); } catch { contenido = m[1]; }
        for (const h of contenido.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) texto += Buffer.from(h[1], "hex").toString("latin1") + "\n";
        for (const p of contenido.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) texto += p[1] + "\n";
    }
    return texto;
}

const post = async (ruta, cuerpo, usuario, fva) => {
    const headers = { "Content-Type": "application/json", ...(usuario ? { "X-Prueba-Usuario": usuario } : {}), ...(fva ? { "X-Prueba-Fva": fva } : {}) };
    const r = await fetch(base + ruta, { method: "POST", headers, body: JSON.stringify(cuerpo) });
    return { status: r.status, cuerpo: await r.json().catch(() => null) };
};
async function preparar({ usuario = "duenio", tipo = "cotizacion", pdf, campos = {} } = {}) {
    const fd = new FormData();
    const datos = {
        tipo_documento: tipo, titulo: `Documento ${tipo}`, id_profesional_firmante: ID_PROFESIONAL, id_paciente: ID_PACIENTE,
        metadatos: JSON.stringify({ resumen: `${tipo} · prueba`, ...(tipo === "consentimiento_informado" ? { texto_renderizado: "Yo, paciente, acepto…" } : {}) }),
        zona_firma: JSON.stringify(ZONA_FIRMA),
        ...(tipo === "consentimiento_informado" ? { zona_paciente: JSON.stringify(ZONA_PACIENTE), aceptante_nombre: "Camila Rojas" } : {}),
        ...campos,
    };
    for (const [k, v] of Object.entries(datos)) if (v !== undefined) fd.append(k, String(v));
    fd.append("pdf", new Blob([pdf ?? await cuerpoPdf()], { type: "application/pdf" }), "documento.pdf");
    const r = await fetch(`${base}/documentos/prepararDocumento`, { method: "POST", headers: { "X-Prueba-Usuario": usuario }, body: fd });
    return { status: r.status, cuerpo: await r.json().catch(() => null) };
}
const evento = async (tipo, id_documento) => (await db.ejecutarQuery(
    "SELECT * FROM firma_evento WHERE tipo_evento = ? AND id_documento = UUID_TO_BIN(?)", [tipo, id_documento]));
const fila = async (id) => (await db.ejecutarQuery(
    "SELECT estado, pdf_key, pdf_sha256, paciente_canal, paciente_destino FROM documento_emitido WHERE id_documento = UUID_TO_BIN(?)", [id]))[0];

before(async () => {
    console.error = (...a) => errores.push(a.join(" "));
    for (const u of Object.values(USUARIOS)) {
        const [{ id }] = await db.ejecutarQuery("SELECT UUID() AS id");
        u.idUsuario = id;
        await db.ejecutarQuery(
            "INSERT INTO usuario_plataforma (id_usuario, clerk_user_id, id_profesional, nombre, rol) VALUES (UUID_TO_BIN(?), ?, ?, ?, ?)",
            [id, u.clerkId, u.idProfesional, u.nombre, u.rol]);
    }
    const app = express();
    app.use(express.json());
    app.use("/documentos", rutasDocumentos);
    app.use("/firmaProfesional", rutasFirma);
    await new Promise((r) => { servidor = app.listen(0, "127.0.0.1", r); });
    base = `http://127.0.0.1:${servidor.address().port}`;

    // La profesional registra su firma (Fase 6), como en la plataforma.
    const acta = (await post("/firmaProfesional/seleccionarActaVigente", {}, "duenio")).cuerpo.acta;
    const png = await sharp({ create: { width: 900, height: 360, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: Buffer.from(`<svg width="900" height="360"><path d="M60 250 C 200 40, 380 330, 520 120 S 780 260, 840 90" stroke="#1d4ed8" stroke-width="10" fill="none"/></svg>`) }])
        .png().toBuffer();
    const fd = new FormData();
    const trazos = [Array.from({ length: 40 }, (_, i) => ({ x: i * 5, y: 50 + (i % 7), t: i * 16 }))];
    for (const [k, v] of Object.entries({ id_profesional: ID_PROFESIONAL, tinta: "azul", trazos: JSON.stringify(trazos), acta_version: acta.version, acta_aceptada: "true" })) fd.append(k, String(v));
    fd.append("imagen", new Blob([png], { type: "image/png" }), "firma.png");
    const r = await fetch(`${base}/firmaProfesional/registrarFirma`, { method: "POST", headers: { "X-Prueba-Usuario": "duenio", "X-Prueba-Fva": "1,-1" }, body: fd });
    assert.equal(r.status, 200, "la firma de la profesional quedó registrada");
});

after(async () => {
    console.error = logOriginal;
    delete process.env.FIRMA_HABILITADA;
    if (servidor) await new Promise((r) => servidor.close(r));
    await db.cerrarConexion();
    DataBase.instance = null;
});

// ── Pruebas ─────────────────────────────────────────────────────────────────
test("sin sesión: todas las rutas responden 401", async () => {
    for (const r of ["prepararDocumento", "seleccionarBorrador", "firmarDocumento", "descargarDocumento", "enviarDocumentoCorreo",
        "listarDocumentosPaciente", "listarPendientesFirma", "anularDocumento", "solicitarOtpPaciente", "verificarOtpPaciente"]) {
        assert.equal((await post(`/documentos/${r}`, {})).status, 401, r);
    }
});

test("preparar: recepción no; recetas no pasan por aquí; solo PDF; la zona debe caber en la página", async () => {
    assert.equal((await preparar({ usuario: "recepcion" })).status, 403);
    assert.deepEqual((await preparar({ tipo: "receta" })).cuerpo, { message: "tipoDocumentoNoPermitido" });
    assert.deepEqual((await preparar({ pdf: Buffer.from("no soy un pdf") })).cuerpo, { message: "pdfInvalido" });
    assert.deepEqual((await preparar({ campos: { zona_firma: JSON.stringify({ ...ZONA_FIRMA, y: 260 }) } })).cuerpo, { message: "datoinvalido" });
    assert.deepEqual((await preparar({ campos: { zona_paciente: JSON.stringify(ZONA_PACIENTE) } })).cuerpo, { message: "tipoDocumentoNoPermitido" },
        "solo el consentimiento lleva zona del paciente");
    assert.deepEqual((await preparar({ tipo: "consentimiento_informado", campos: { zona_paciente: undefined } })).cuerpo, { message: "datoinvalido" });
});

let cotizacion;
test("preparar y firmar una cotización: estampa firma, texto legal y QR, y la guarda una sola vez con su huella", async () => {
    let r = await preparar();
    assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
    cotizacion = r.cuerpo.documento;
    assert.equal(cotizacion.estado, "pendiente_firma");
    assert.match(cotizacion.codigo_verificacion, /^[0-9A-Z]{4}-[0-9A-Z]{4}$/);

    assert.equal((await post("/documentos/firmarDocumento", { id_documento: cotizacion.id_documento }, "duenio", "30,-1")).cuerpo.message, "reverificacionRequerida");
    assert.deepEqual((await post("/documentos/firmarDocumento", { id_documento: cotizacion.id_documento }, "otro")).cuerpo, { message: "sinPermiso" });
    assert.deepEqual((await post("/documentos/firmarDocumento", { id_documento: cotizacion.id_documento }, "admin")).cuerpo, { message: "sinPermiso" },
        "un administrador no firma por la profesional");

    r = await post("/documentos/firmarDocumento", { id_documento: cotizacion.id_documento }, "duenio");
    assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.documento.estado, "firmado");

    const f = await fila(cotizacion.id_documento);
    const pdf = r2.get(f.pdf_key);
    assert.equal(sha256(pdf), f.pdf_sha256, "el PDF guardado coincide con su huella");
    const cargado = await PDFDocument.load(pdf);
    assert.equal(cargado.getPageCount(), 1);
    const texto = textoDelPdf(pdf);
    assert.match(texto, new RegExp(cotizacion.codigo_verificacion), "el código de verificación está impreso");
    assert.match(texto, /Firmado electrónicamente|firma electrónica|Ley 19\.799/i, "lleva el texto legal");
    assert.equal((await evento("documento_firmado", cotizacion.id_documento)).length, 1);
});

test("un documento firmado no se vuelve a firmar", async () => {
    assert.deepEqual((await post("/documentos/firmarDocumento", { id_documento: cotizacion.id_documento }, "duenio")).cuerpo, { message: "documentoYaFirmado" });
});

test("descargar: URL firmada y huella; queda en la bitácora", async () => {
    const r = await post("/documentos/descargarDocumento", { id_documento: cotizacion.id_documento, accion: "descargado" }, "duenio");
    assert.equal(r.status, 200);
    assert.match(r.cuerpo.url, /^https:\/\/r2\.prueba\/documentos\/firmados\//);
    assert.equal(r.cuerpo.sha256, (await fila(cotizacion.id_documento)).pdf_sha256);
    const [{ n }] = await db.ejecutarQuery("SELECT COUNT(*) n FROM documento_acceso WHERE id_documento = UUID_TO_BIN(?) AND accion = 'descargado'", [cotizacion.id_documento]);
    assert.equal(n, 1);
    assert.equal((await post("/documentos/descargarDocumento", { id_documento: cotizacion.id_documento, accion: "borrar" }, "duenio")).status, 400);
});

test("enviar por correo: adjunta exactamente el PDF firmado", async () => {
    const r = await post("/documentos/enviarDocumentoCorreo", { id_documento: cotizacion.id_documento }, "duenio");
    assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
    assert.match(r.cuerpo.enviadoA, /@/);
    const adjunto = correos.at(-1).adjuntos[0].contenido;
    assert.equal(sha256(adjunto), (await fila(cotizacion.id_documento)).pdf_sha256);
    assert.deepEqual((await post("/documentos/enviarDocumentoCorreo", { id_documento: cotizacion.id_documento, correo: "no-es-correo" }, "duenio")).cuerpo, { message: "correoInvalido" });
});

let consentimiento;
test("consentimiento: no se firma sin la aceptación del paciente", async () => {
    const r = await preparar({ tipo: "consentimiento_informado" });
    assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
    consentimiento = r.cuerpo.documento;
    assert.deepEqual((await post("/documentos/firmarDocumento", { id_documento: consentimiento.id_documento }, "duenio")).cuerpo, { message: "otpRequerido" });
});

test("código por WhatsApp: plantilla de autenticación aprobada, al teléfono de la ficha, solo el código", async () => {
    assert.equal((await post("/documentos/solicitarOtpPaciente", { id_documento: consentimiento.id_documento, canal: "telegram" }, "duenio")).status, 400);
    assert.equal((await post("/documentos/solicitarOtpPaciente", { id_documento: cotizacion.id_documento, canal: "whatsapp" }, "duenio")).status, 409,
        "una cotización ya firmada no pide código");

    const r = await post("/documentos/solicitarOtpPaciente", { id_documento: consentimiento.id_documento, canal: "whatsapp" }, "duenio");
    assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
    assert.match(r.cuerpo.destino, /•/, "el destino vuelve enmascarado");
    const m = whatsapps.at(-1);
    assert.equal(m.contentSid, "HXprueba_otp");
    assert.equal(m.from, "whatsapp:+15550001111");
    assert.match(m.to, /^whatsapp:\+569\d{8}$/);
    const variables = JSON.parse(m.contentVariables);
    assert.deepEqual(Object.keys(variables), ["1"], "la plantilla solo recibe el código: nada del procedimiento ni de salud");
    assert.match(variables["1"], /^\d{6}$/);
    const [otp] = await db.ejecutarQuery("SELECT canal, codigo_hash FROM paciente_otp WHERE id_documento = UUID_TO_BIN(?) ORDER BY creado_at DESC LIMIT 1", [consentimiento.id_documento]);
    assert.equal(otp.canal, "whatsapp");
    assert.notEqual(otp.codigo_hash, variables["1"], "el código no se guarda en claro");
});

test("verificar el código: incorrecto suma intento; correcto registra la aceptación por WhatsApp", async () => {
    const codigo = JSON.parse(whatsapps.at(-1).contentVariables)["1"];
    const otroCodigo = codigo === "000000" ? "111111" : "000000";
    assert.deepEqual((await post("/documentos/verificarOtpPaciente", { id_documento: consentimiento.id_documento, codigo: otroCodigo }, "duenio")).cuerpo, { message: "otpInvalido" });
    const r = await post("/documentos/verificarOtpPaciente", { id_documento: consentimiento.id_documento, codigo }, "duenio");
    assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.aceptacion.canal, "whatsapp");
    const [ev] = await evento("otp_paciente_verificado", consentimiento.id_documento);
    assert.equal(ev.metodo_autenticacion, "otp_whatsapp");
    assert.equal(ev.actor_tipo, "paciente");
    assert.equal((await fila(consentimiento.id_documento)).paciente_canal, "whatsapp");
});

test("firmar el consentimiento: el PDF dice que el paciente aceptó con código enviado por WhatsApp", async () => {
    const r = await post("/documentos/firmarDocumento", { id_documento: consentimiento.id_documento }, "duenio");
    assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
    const f = await fila(consentimiento.id_documento);
    const texto = textoDelPdf(r2.get(f.pdf_key));
    assert.match(texto, /enviado por WhatsApp a/, "canal real en el PDF");
    assert.match(texto, /Camila Rojas/, "quién aceptó");
});

test("código por correo: también funciona y deja canal email", async () => {
    const doc = (await preparar({ tipo: "consentimiento_informado" })).cuerpo.documento;
    const r = await post("/documentos/solicitarOtpPaciente", { id_documento: doc.id_documento, canal: "email" }, "duenio");
    assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
    assert.match(correos.at(-1).html, /\d{6}/);
    const codigo = correos.at(-1).html.match(/(\d{6})/)[1];
    const v = await post("/documentos/verificarOtpPaciente", { id_documento: doc.id_documento, codigo }, "duenio");
    assert.equal(v.cuerpo.aceptacion?.canal, "email", JSON.stringify(v.cuerpo));
    assert.equal((await evento("otp_paciente_verificado", doc.id_documento))[0].metodo_autenticacion, "otp_email");
});

test("WhatsApp sin plantilla configurada: no envía y avisa (503)", async () => {
    const doc = (await preparar({ tipo: "consentimiento_informado" })).cuerpo.documento;
    const guardado = process.env.TWILIO_CONTENT_SID_OTP;
    delete process.env.TWILIO_CONTENT_SID_OTP;
    const antes = whatsapps.length;
    assert.equal((await post("/documentos/solicitarOtpPaciente", { id_documento: doc.id_documento, canal: "whatsapp" }, "duenio")).status, 503);
    assert.equal(whatsapps.length, antes);
    process.env.TWILIO_CONTENT_SID_OTP = guardado;
});

test("listados: por paciente (rol clínico) y pendientes de la firmante", async () => {
    const lista = (await post("/documentos/listarDocumentosPaciente", { id_paciente: ID_PACIENTE }, "admin")).cuerpo.documentos;
    assert.ok(lista.some((d) => d.id_documento === cotizacion.id_documento && d.estado === "firmado"));
    assert.equal((await post("/documentos/listarDocumentosPaciente", { id_paciente: ID_PACIENTE }, "recepcion")).status, 403);
    const pendientes = (await post("/documentos/listarPendientesFirma", {}, "duenio")).cuerpo.documentos;
    assert.ok(pendientes.length >= 2 && pendientes.every((d) => d.estado === "pendiente_firma"));
    assert.deepEqual((await post("/documentos/listarPendientesFirma", {}, "admin")).cuerpo.documentos, []);
});

test("bandeja: lo que otro prepara para la firmante aparece en sus 'documentos', en los 'enviados' de quien lo preparó y en 'clinica' para administración", async () => {
    const doc = (await preparar({ usuario: "otro", tipo: "ficha_clinica" })).cuerpo.documento;
    const deDuenia = (await post("/documentos/listarPendientesFirma", {}, "duenio")).cuerpo;
    assert.ok(deDuenia.documentos.some((d) => d.id_documento === doc.id_documento), "la firmante lo ve para firmar");
    assert.ok(!deDuenia.enviados.some((d) => d.id_documento === doc.id_documento));
    assert.deepEqual(deDuenia.clinica, [], "una profesional no ve lo de toda la clínica");
    const deOtro = (await post("/documentos/listarPendientesFirma", {}, "otro")).cuerpo;
    assert.ok(deOtro.enviados.some((d) => d.id_documento === doc.id_documento && d.firmante_nombre), "quien lo preparó lo ve esperando, con el nombre de la firmante");
    assert.ok(!deOtro.documentos.some((d) => d.id_documento === doc.id_documento), "pero no puede firmarlo");
    const deAdmin = (await post("/documentos/listarPendientesFirma", {}, "admin")).cuerpo;
    assert.ok(deAdmin.clinica.some((d) => d.id_documento === doc.id_documento), "administración ve todo lo pendiente");
    assert.deepEqual((await post("/documentos/firmarDocumento", { id_documento: doc.id_documento }, "otro")).cuerpo, { message: "sinPermiso" });
});

test("anular: pide reverificación y motivo; un anulado no se firma y queda en la evidencia", async () => {
    const doc = (await preparar({ tipo: "orden_examen" })).cuerpo.documento;
    assert.equal((await post("/documentos/anularDocumento", { id_documento: doc.id_documento, motivo: "Error" }, "duenio", "40,-1")).status, 403);
    assert.equal((await post("/documentos/anularDocumento", { id_documento: doc.id_documento }, "duenio")).status, 400);
    assert.equal((await post("/documentos/anularDocumento", { id_documento: doc.id_documento, motivo: "Examen equivocado" }, "duenio")).status, 200);
    assert.deepEqual((await post("/documentos/firmarDocumento", { id_documento: doc.id_documento }, "duenio")).cuerpo, { message: "documentoAnulado" });
    assert.equal((await evento("documento_anulado", doc.id_documento)).length, 1);
});

test("los cinco tipos de la plataforma se preparan y firman (menos recetas)", async () => {
    for (const tipo of ["presupuesto", "orden_examen", "ficha_clinica"]) {
        const doc = (await preparar({ tipo })).cuerpo.documento;
        const r = await post("/documentos/firmarDocumento", { id_documento: doc.id_documento }, "duenio");
        assert.equal(r.status, 200, `${tipo}: ${JSON.stringify(r.cuerpo)}`);
    }
});

test("interruptor de emergencia: FIRMA_HABILITADA=0 apaga preparar y firmar; descargar sigue", async () => {
    process.env.FIRMA_HABILITADA = "0";
    assert.equal((await preparar()).status, 503);
    assert.equal((await post("/documentos/descargarDocumento", { id_documento: cotizacion.id_documento }, "duenio")).status, 200);
    delete process.env.FIRMA_HABILITADA;
});

test("ningún error inesperado en el log", () => {
    assert.deepEqual(errores.filter((e) => !/ExperimentalWarning|WhatsApp OTP no configurado/.test(e)), []);
});
