/*
    Bandeja de documentos por firmar: vencimiento automático (aviso a los 7 días, anulación
    a los 30; consentimiento a las 24 h), botón Quitar y campana con lo de cada uno.

    HTTP → routers y controladores reales → MySQL. Clerk y R2 se SIMULAN.

    Requiere una base de PRUEBA con el dump, las migraciones de docs/firma y las de migraciones/:
      DB_HOST=127.0.0.1 DB_PORT=3407 DB_USER=prueba DB_PASS=prueba DB_DATABASE=ac_venc \
        node --experimental-test-module-mocks --test pruebas/firma/vencimiento.e2e.mjs
*/
import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";
import express from "express";
import { PDFDocument } from "pdf-lib";

if (!process.env.DB_DATABASE || /produccion/i.test(process.env.DB_DATABASE)) {
    console.error("Configura DB_* con una base de PRUEBA."); process.exit(1);
}
process.env.FIRMA_HMAC_CLAVE ||= "clave-de-prueba-solo-para-tests-0123456789abcdef";
process.env.FIRMA_HMAC_VERSION ||= "1";

const ID_PROFESIONAL = 46;
const ID_OTRO = 45;
const USUARIOS = {
    duenio: { clerkId: "user_v_duenio", rol: "profesional-medico", nombre: "Dueña", idProfesional: ID_PROFESIONAL },
    otro: { clerkId: "user_v_otro", rol: "profesional-medico", nombre: "Otro", idProfesional: ID_OTRO },
    admin: { clerkId: "user_v_admin", rol: "admin-clinica", nombre: "Admin", idProfesional: null },
    recepcion: { clerkId: "user_v_recep", rol: "recepcion", nombre: "Recepción", idProfesional: null },
};
mock.module("../../middleware/exigirUsuarioClerk.js", {
    namedExports: {
        exigirUsuarioClerk: (req, res, next) => {
            const u = USUARIOS[req.get("x-prueba-usuario")];
            if (!u) return res.status(401).json({ message: "noAutorizado" });
            req.usuario = { ...u, fva: [1, -1] };
            req.contexto = { ip: "127.0.0.1", userAgent: "Prueba/1.0" };
            return next();
        },
    },
});
const r2 = new Map();
mock.module("../../services/r2Storage.js", {
    namedExports: {
        construirKey: (id, n) => `pacientes/${id}/${n}`,
        construirKeyPrivada: (carpeta, ext) => `${carpeta}/prueba-${r2.size + 1}-${Math.random().toString(36).slice(2)}.${ext}`,
        subirArchivo: async (buffer, key) => { r2.set(key, Buffer.from(buffer)); },
        eliminarArchivoR2: async (key) => { r2.delete(key); },
        generarUrlDescarga: async (key) => `https://r2.prueba/${key}`,
        descargarArchivoComoBuffer: async (key) => r2.get(key),
        listarClaves: async () => ({ claves: [] }),
    },
});

const { default: rutasDocumentos } = await import("../../view/documentosRoutes.js");
const { default: rutasNotificaciones } = await import("../../view/notificacionesPushRoutes.js");
const { revisarVencimientos } = await import("../../services/firma/vencimientoDocumentos.js");
const { default: DataBase } = await import("../../config/Database.js");
const db = DataBase.getInstance();
let servidor, base;

const post = async (ruta, cuerpo, usuario) => {
    const r = await fetch(base + ruta, { method: "POST", headers: { "Content-Type": "application/json", "X-Prueba-Usuario": usuario }, body: JSON.stringify(cuerpo) });
    return { status: r.status, cuerpo: await r.json().catch(() => null) };
};
async function preparar(tipo = "cotizacion") {
    const pdf = await PDFDocument.create(); pdf.addPage([612, 792]);
    const fd = new FormData();
    const datos = {
        tipo_documento: tipo, titulo: `Documento ${tipo}`, id_profesional_firmante: ID_PROFESIONAL, id_paciente: 2283,
        metadatos: JSON.stringify({ resumen: "prueba", ...(tipo === "consentimiento_informado" ? { texto_renderizado: "Acepto…" } : {}) }),
        zona_firma: JSON.stringify({ pagina: 1, x: 15, y: 200, ancho: 186, alto: 56 }),
        ...(tipo === "consentimiento_informado" ? { zona_paciente: JSON.stringify({ pagina: 1, x: 15, y: 165, ancho: 186, alto: 26 }) } : {}),
    };
    for (const [k, v] of Object.entries(datos)) fd.append(k, String(v));
    fd.append("pdf", new Blob([Buffer.from(await pdf.save())], { type: "application/pdf" }), "d.pdf");
    const r = await fetch(`${base}/documentos/prepararDocumento`, { method: "POST", headers: { "X-Prueba-Usuario": "admin" }, body: fd });
    return (await r.json()).documento;
}
const envejecer = (id, horas) => db.ejecutarQuery(
    "UPDATE documento_emitido SET preparado_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? HOUR) WHERE id_documento = UUID_TO_BIN(?)", [horas, id]);
const fila = async (id) => (await db.ejecutarQuery(
    "SELECT estado, motivo_anulacion, borrador_key, aviso_vencimiento_at FROM documento_emitido WHERE id_documento = UUID_TO_BIN(?)", [id]))[0];
const evento = async (id) => (await db.ejecutarQuery(
    "SELECT actor_tipo, metodo_autenticacion FROM firma_evento WHERE tipo_evento = 'documento_anulado' AND id_documento = UUID_TO_BIN(?)", [id]))[0];

before(async () => {
    for (const u of Object.values(USUARIOS)) {
        const [{ id }] = await db.ejecutarQuery("SELECT UUID() AS id");
        u.idUsuario = id;
        await db.ejecutarQuery("INSERT INTO usuario_plataforma (id_usuario, clerk_user_id, id_profesional, nombre, rol) VALUES (UUID_TO_BIN(?), ?, ?, ?, ?)",
            [id, u.clerkId, u.idProfesional, u.nombre, u.rol]);
    }
    const app = express();
    app.use(express.json());
    app.use("/documentos", rutasDocumentos);
    app.use("/notificaciones", rutasNotificaciones);
    await new Promise((r) => { servidor = app.listen(0, "127.0.0.1", r); });
    base = `http://127.0.0.1:${servidor.address().port}`;
});
after(async () => {
    if (servidor) await new Promise((r) => servidor.close(r));
    await db.cerrarConexion();
    DataBase.instance = null;
});

const docs = {};
test("vencimiento: 2 días nada; 8 días aviso; 31 días anulado; consentimiento de 25 h anulado", async () => {
    for (const [nombre, tipo, horas] of [["reciente", "cotizacion", 48], ["aviso", "orden_examen", 8 * 24], ["viejo", "presupuesto", 31 * 24], ["consentimiento", "consentimiento_informado", 25]]) {
        docs[nombre] = await preparar(tipo);
        await envejecer(docs[nombre].id_documento, horas);
    }
    const borradorViejo = (await fila(docs.viejo.id_documento)).borrador_key;
    assert.ok(r2.has(borradorViejo));

    const r = await revisarVencimientos();
    assert.ok(r.vencidos >= 2 && r.avisos >= 1, JSON.stringify(r));

    assert.equal((await fila(docs.reciente.id_documento)).estado, "pendiente_firma");
    const aviso = await fila(docs.aviso.id_documento);
    assert.equal(aviso.estado, "pendiente_firma");
    assert.ok(aviso.aviso_vencimiento_at, "queda marcado como avisado");
    for (const n of ["viejo", "consentimiento"]) {
        const f = await fila(docs[n].id_documento);
        assert.equal(f.estado, "anulado", n);
        assert.match(f.motivo_anulacion, /Vencido sin firmar/);
        assert.deepEqual(await evento(docs[n].id_documento), { actor_tipo: "sistema", metodo_autenticacion: "sistema" }, n);
    }
    assert.ok(!r2.has(borradorViejo), "el borrador vencido se borra de R2");

    const [n] = await db.ejecutarQuery("SELECT titulo, descripcion FROM notificaciones_inapp WHERE id_profesional = ? AND tipo = 'documento_firma'", [ID_PROFESIONAL]);
    assert.match(n.titulo, /esperando tu firma/);
    assert.doesNotMatch(`${n.titulo} ${n.descripcion}`, /Ortega|2283|RUT/, "el aviso no nombra pacientes");
});

test("una segunda vuelta no vuelve a avisar ni anular", async () => {
    const r = await revisarVencimientos();
    assert.deepEqual(r, { vencidos: 0, avisos: 0 });
    const [{ n }] = await db.ejecutarQuery("SELECT COUNT(*) n FROM notificaciones_inapp WHERE id_profesional = ? AND tipo = 'documento_firma'", [ID_PROFESIONAL]);
    assert.equal(n, 1);
});

test("la bandeja dice cuándo vence cada documento", async () => {
    const lista = (await post("/documentos/listarPendientesFirma", {}, "duenio")).cuerpo.documentos;
    const reciente = lista.find((d) => d.id_documento === docs.reciente.id_documento);
    const dias = (new Date(reciente.vence_at) - new Date(reciente.preparado_at)) / 86_400_000;
    assert.equal(Math.round(dias), 30);
    assert.ok(!lista.some((d) => d.id_documento === docs.viejo.id_documento), "lo vencido ya no está");
});

test("Quitar: otro profesional no; la firmante sí (sin reverificación), queda en la evidencia y se borra el borrador", async () => {
    assert.equal((await post("/documentos/quitarPendiente", { id_documento: docs.reciente.id_documento }, "otro")).status, 403);
    const clave = (await fila(docs.reciente.id_documento)).borrador_key;
    assert.equal((await post("/documentos/quitarPendiente", { id_documento: docs.reciente.id_documento }, "duenio")).status, 200);
    const f = await fila(docs.reciente.id_documento);
    assert.equal(f.estado, "anulado");
    assert.equal(f.motivo_anulacion, "Quitado de la bandeja sin firmar");
    assert.deepEqual(await evento(docs.reciente.id_documento), { actor_tipo: "profesional", metodo_autenticacion: "clerk_sesion" });
    assert.ok(!r2.has(clave));
    assert.deepEqual((await post("/documentos/quitarPendiente", { id_documento: docs.reciente.id_documento }, "duenio")).cuerpo, { message: "documentoAnulado" });
});

test("Quitar: la administración puede, con su motivo", async () => {
    const r = await post("/documentos/quitarPendiente", { id_documento: docs.aviso.id_documento, motivo: "Enviado por error" }, "admin");
    assert.equal(r.status, 200);
    assert.equal((await fila(docs.aviso.id_documento)).motivo_anulacion, "Enviado por error");
    assert.equal((await evento(docs.aviso.id_documento)).actor_tipo, "operador");
});

test("campana: cada profesional ve lo suyo; administración y recepción ven las citas, nunca los avisos de firma de otro", async () => {
    await db.ejecutarQuery("INSERT INTO notificaciones_inapp (id_profesional, titulo, tipo) VALUES (?, 'Cita de la dueña', 'cita'), (?, 'Cita del otro', 'cita')", [ID_PROFESIONAL, ID_OTRO]);
    const ver = async (u) => (await (await fetch(`${base}/notificaciones/pendientes`, { headers: { "X-Prueba-Usuario": u } })).json()).map((n) => n.titulo);
    const deDuenia = await ver("duenio");
    assert.ok(deDuenia.includes("Cita de la dueña") && deDuenia.some((t) => /esperando tu firma/.test(t)));
    assert.ok(!deDuenia.includes("Cita del otro"));
    assert.deepEqual(await ver("otro"), ["Cita del otro"]);
    for (const u of ["admin", "recepcion"]) {
        const vistas = await ver(u);
        assert.ok(vistas.includes("Cita de la dueña") && vistas.includes("Cita del otro"), u);
        assert.ok(!vistas.some((t) => /esperando tu firma/.test(t)), `${u} no ve los avisos de firma de la profesional`);
    }
    // "Marcar todas" del otro no borra las de la dueña.
    await fetch(`${base}/notificaciones/leer-todas`, { method: "POST", headers: { "X-Prueba-Usuario": "otro" } });
    assert.deepEqual(await ver("otro"), []);
    assert.ok((await ver("duenio")).includes("Cita de la dueña"));
});
