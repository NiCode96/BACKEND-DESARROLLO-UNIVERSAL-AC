/* Identificadores de la firma electrónica.
 *
 * - IDs: UUIDv7 (ordenables por tiempo). En MySQL se guardan como BINARY(16):
 *   escribir con UUID_TO_BIN(?) y leer con BIN_TO_UUID(col) AS col.
 * - Código de verificación: "A7K2-9QX4", 8 caracteres Crockford base32 (sin I, L,
 *   O ni U, para que no se confundan al dictarlos). Va en el QR y en el pie.
 * - Token de aceptación: une las dos casillas de la reserva pública con la
 *   reserva que se crea después. */

import { v7 as uuidv7 } from "uuid";
import { randomBytes } from "node:crypto";

export const nuevoId = () => uuidv7();

const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function codigoVerificacion() {
    const c = [...randomBytes(8)].map((x) => ALFABETO[x & 31]).join("");
    return `${c.slice(0, 4)}-${c.slice(4)}`;
}

export const FORMATO_CODIGO = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

export const tokenAceptacion = () => `ca_${randomBytes(16).toString("hex")}`;

/** true si el error de MySQL es un UNIQUE repetido (para reintentar con otro código). */
export const esDuplicado = (error) => error?.code === "ER_DUP_ENTRY";
