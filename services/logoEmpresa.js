/*
    logoEmpresa.js
    Reglas del logo del centro (columna datos_empresa.logoEmpresa).

    Se guarda el id que devuelve POST /cloudflare/subirimagenes, nunca una URL:
    así nadie puede apuntar el logo a un sitio externo, y el front arma la URL
    con el mismo hash de entrega que usa para el resto de las imágenes.

    Valores aceptados:
      - un id de Cloudflare Images (letras, números, guion, punto o guion bajo;
        sin "/", ":" ni espacios; hasta 100 caracteres) → se guarda tal cual;
      - "" o null → se guarda NULL (quitar el logo).
    Cualquier otra cosa se RECHAZA, no se corrige en silencio.

    Funciones puras, sin base de datos: se prueban en pruebas/datosEmpresa/.
*/

export const MAX_LARGO_ID_LOGO = 100;
export const CODIGO_LOGO_INVALIDO = "LOGO_INVALIDO";
export const CODIGO_EMPRESA_INVALIDA = "EMPRESA_INVALIDA";

const PATRON_ID_CLOUDFLARE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function crearError(codigo, mensaje) {
    const error = new Error(mensaje);
    error.code = codigo;
    return error;
}

/* Devuelve el id limpio, o null para quitar el logo. Lanza LOGO_INVALIDO si no sirve. */
export function normalizarLogoEmpresa(valor) {
    if (valor === null || valor === undefined) return null;
    if (typeof valor !== "string") {
        throw crearError(CODIGO_LOGO_INVALIDO, "El logo debe ser el id de la imagen (texto).");
    }

    const limpio = valor.trim();
    if (limpio === "") return null;

    if (limpio.length > MAX_LARGO_ID_LOGO || !PATRON_ID_CLOUDFLARE.test(limpio)) {
        throw crearError(CODIGO_LOGO_INVALIDO, "El logo debe ser un id de Cloudflare Images, no una URL.");
    }
    return limpio;
}

/* id_empresa entero positivo (llega como número o como texto desde el front). */
export function normalizarIdEmpresa(valor) {
    const texto = String(valor ?? "").trim();
    if (!/^\d{1,10}$/.test(texto) || Number(texto) <= 0) {
        throw crearError(CODIGO_EMPRESA_INVALIDA, "id_empresa debe ser un entero positivo.");
    }
    return Number(texto);
}
