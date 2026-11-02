/* Huellas criptográficas.
 *  - sha256: identifica un archivo o un texto (si cambia un byte, cambia la huella).
 *  - hmac: sella la cadena de evidencia con una clave que solo tiene el servidor;
 *    sin la clave nadie puede rehacer la cadena después de alterarla.
 *  - canonico: JSON con claves ordenadas, para que el mismo evento produzca
 *    siempre la misma huella. */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const sha256 = (datos) => createHash("sha256").update(datos).digest("hex");

export const hmacSha256 = (clave, datos) => createHmac("sha256", clave).update(datos).digest("hex");

/** Compara dos huellas hex en tiempo constante (evita ataques por tiempo de respuesta). */
export function huellasIguales(a, b) {
    const x = Buffer.from(String(a ?? ""), "hex");
    const y = Buffer.from(String(b ?? ""), "hex");
    return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/** JSON canónico: claves en orden alfabético (recursivo), sin espacios, undefined → null. */
export function canonico(valor) {
    if (valor === undefined || valor === null) return "null";
    if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
    if (valor instanceof Date) return JSON.stringify(valor.toISOString());
    if (Buffer.isBuffer(valor)) return JSON.stringify(valor.toString("hex"));
    if (typeof valor === "object") {
        return `{${Object.keys(valor).sort().map((k) => `${JSON.stringify(k)}:${canonico(valor[k])}`).join(",")}}`;
    }
    return JSON.stringify(valor);
}

/** Clave HMAC vigente (FIRMA_HMAC_CLAVE en base64, ≥ 32 bytes) y su versión. */
export function claveHmac() {
    const texto = process.env.FIRMA_HMAC_CLAVE || "";
    const clave = Buffer.from(texto, "base64");
    if (clave.length < 32) {
        const error = new Error("[FIRMA] FIRMA_HMAC_CLAVE no configurada o menor a 32 bytes");
        error.codigo = "firmaNoConfigurada";
        throw error;
    }
    return { clave, version: Number(process.env.FIRMA_HMAC_VERSION || 1) };
}

/** Clave de una versión anterior (para verificar eventos antiguos tras rotar). */
export function claveHmacVersion(version) {
    const vigente = claveHmac();
    if (Number(version) === vigente.version) return vigente.clave;
    const anteriores = JSON.parse(process.env.FIRMA_HMAC_CLAVES_ANTERIORES || "{}");
    const texto = anteriores[String(version)];
    return texto ? Buffer.from(texto, "base64") : null;
}
