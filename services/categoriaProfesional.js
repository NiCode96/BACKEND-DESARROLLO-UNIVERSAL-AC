/*
    categoriaProfesional.js
    Categoría de atención del profesional (Odontología, Psicología, Kinesiología…).
    Texto libre que se elige en el dashboard (con sugerencias); la reserva pública
    agrupa a los profesionales por ella. Columna: profesionales.categoriaProfesional.

    Reglas:
      - undefined  → el campo no vino: al editar NO se toca lo guardado
                     (pantallas antiguas no borran la categoría de nadie);
      - "" o null  → NULL (sin categoría);
      - texto      → espacios simples, sin saltos ni caracteres de control,
                     hasta 60 caracteres; solo letras (con tildes y ñ), números,
                     espacios y . , - / ( ) & +  — cualquier otra cosa se RECHAZA.

    Función pura: se prueba en pruebas/profesionales/.
*/

export const MAX_LARGO_CATEGORIA = 60;
export const CODIGO_CATEGORIA_INVALIDA = "CATEGORIA_INVALIDA";
export const SIN_CAMBIO = Symbol("sin-cambio");

const PERMITIDOS = /^[\p{L}\p{M}0-9 .,\-/()&+]+$/u;

function crearError(mensaje) {
    const error = new Error(mensaje);
    error.code = CODIGO_CATEGORIA_INVALIDA;
    return error;
}

export function normalizarCategoriaProfesional(valor) {
    if (valor === undefined) return SIN_CAMBIO;
    if (valor === null) return null;
    if (typeof valor !== "string") throw crearError("La categoría debe ser texto.");

    const limpio = valor.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
    if (limpio === "") return null;
    if (limpio.length > MAX_LARGO_CATEGORIA) throw crearError(`La categoría no puede pasar de ${MAX_LARGO_CATEGORIA} caracteres.`);
    if (!PERMITIDOS.test(limpio)) throw crearError("La categoría tiene caracteres no permitidos.");
    return limpio;
}
