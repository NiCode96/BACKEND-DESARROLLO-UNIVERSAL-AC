/* Verifica la cadena de evidencia de la firma electrónica.
 *
 *   node scripts/verificar_cadena_firma.mjs            → cadena, huellas y sellos HMAC
 *   node scripts/verificar_cadena_firma.mjs --con-pdf  → además baja cada PDF firmado
 *                                                        y compara su SHA-256
 *
 * Sale con código 1 ante cualquier diferencia e indica la primera secuencia rota.
 * Programarlo a diario (cron) y avisar si falla: una cadena rota significa que
 * alguien alteró la evidencia (docs/firma/03 §9.6). */

import "dotenv/config";
import DataBase from "../config/Database.js";
import { camposCanonicos } from "../services/firma/cadenaEvidencia.js";
import { sha256, hmacSha256, canonico, claveHmacVersion } from "../services/firma/huellas.js";
import { descargarArchivoComoBuffer } from "../services/r2Storage.js";

const conPdf = process.argv.includes("--con-pdf");
const db = DataBase.getInstance();
const ISO = (c) => `DATE_FORMAT(${c}, '%Y-%m-%dT%H:%i:%s.%fZ') AS ${c}`;
const recortar = (v) => (v ? String(v).replace(/(\.\d{3})\d*Z$/, "$1Z") : null);
const uuid = (c) => `BIN_TO_UUID(${c}) AS ${c}`;

let errores = 0;
function fallo(mensaje) {
    errores++;
    console.error(`✗ ${mensaje}`);
}

try {
    const eventos = await db.ejecutarQuery(`
        SELECT ${uuid("id_evento")}, secuencia, tipo_evento, ${uuid("id_documento")}, ${uuid("id_firma")}, ${uuid("id_aceptacion")},
               id_profesional, id_paciente, actor_tipo, actor_clerk_id, actor_nombre, metodo_autenticacion,
               ${ISO("autenticado_at")}, documento_sha256, datos_json, ip, user_agent, ${ISO("ocurrido_at")},
               hash_anterior, hash_evento, sello_hmac, clave_version
        FROM firma_evento ORDER BY secuencia ASC`);

    let anterior = "0".repeat(64);
    let esperada = 1;
    for (const e of eventos) {
        const secuencia = Number(e.secuencia);
        if (secuencia !== esperada) fallo(`secuencia ${secuencia}: se esperaba ${esperada} (falta un evento)`);
        if (e.hash_anterior !== anterior) fallo(`secuencia ${secuencia}: hash_anterior no coincide con el evento previo`);
        const datos = typeof e.datos_json === "string" ? JSON.parse(e.datos_json) : e.datos_json;
        const recalculado = sha256(canonico(camposCanonicos({
            ...e, autenticado_at: recortar(e.autenticado_at), ocurrido_at: recortar(e.ocurrido_at), datos_json: datos,
        })));
        if (recalculado !== e.hash_evento) fallo(`secuencia ${secuencia}: el contenido del evento fue modificado`);
        const clave = claveHmacVersion(e.clave_version);
        if (!clave) fallo(`secuencia ${secuencia}: falta la clave HMAC versión ${e.clave_version}`);
        else if (hmacSha256(clave, e.hash_evento) !== e.sello_hmac) fallo(`secuencia ${secuencia}: sello HMAC inválido`);
        anterior = e.hash_evento;
        esperada = secuencia + 1;
        if (errores) break; // desde el primer error, todo lo siguiente también falla
    }

    const [estado] = await db.ejecutarQuery("SELECT ultima_secuencia, ultimo_hash FROM firma_cadena_estado WHERE id = 1");
    if (!errores && (Number(estado.ultima_secuencia) !== esperada - 1 || estado.ultimo_hash !== anterior)) {
        fallo("firma_cadena_estado no apunta al último evento");
    }

    if (conPdf && !errores) {
        const documentos = await db.ejecutarQuery("SELECT codigo_verificacion, pdf_key, pdf_sha256 FROM documento_emitido WHERE pdf_key IS NOT NULL");
        const constancias = await db.ejecutarQuery("SELECT codigo_verificacion, pdf_key, pdf_sha256 FROM consentimiento_aceptacion");
        for (const d of [...documentos, ...constancias]) {
            // De a uno, sin paralelismo: no carga la memoria ni la conexión.
            const bytes = await descargarArchivoComoBuffer(d.pdf_key).catch(() => null);
            if (!bytes) fallo(`${d.codigo_verificacion}: el archivo no existe en R2`);
            else if (sha256(bytes) !== d.pdf_sha256) fallo(`${d.codigo_verificacion}: el PDF guardado fue modificado`);
        }
        console.log(`PDF revisados: ${documentos.length + constancias.length}`);
    }

    if (errores) {
        console.error(`Cadena con ${errores} problema(s). Revisar de inmediato (docs/firma/03 §8.8).`);
        process.exitCode = 1;
    } else {
        console.log(`Cadena íntegra (${eventos.length} eventos).`);
    }
} catch (error) {
    console.error("No se pudo verificar la cadena:", error.message);
    process.exitCode = 1;
} finally {
    await db.cerrarConexion();
    // Salida explícita: config/Database.js vuelve a cerrar el pool en "beforeExit".
    process.exit(process.exitCode ?? 0);
}
