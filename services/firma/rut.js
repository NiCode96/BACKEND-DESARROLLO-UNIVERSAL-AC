/* Validación de documentos de identidad (misma regla que src/lib/rut.js del front).
 *  - RUT chileno: dígito verificador por módulo 11.
 *  - Pasaporte o DNI (pacientes extranjeros): 5 a 20 caracteres alfanuméricos. El DNI
 *    (cédula de otro país) no tiene una regla común entre países: se valida igual que el
 *    pasaporte, y el tipo queda guardado para mostrar el documento correcto. */

export const TIPOS_DOCUMENTO = Object.freeze(["rut", "pasaporte", "dni"]);
export const ETIQUETAS_DOCUMENTO = Object.freeze({ rut: "RUT", pasaporte: "Pasaporte", dni: "DNI" });
export const esDocumentoExtranjero = (tipo) => tipo === "pasaporte" || tipo === "dni";

export const limpiarRut = (rut) => String(rut ?? "").replace(/[^0-9kK]/g, "").toUpperCase();

export function calcularDv(cuerpo) {
    let suma = 0;
    let multiplo = 2;
    for (let i = String(cuerpo).length - 1; i >= 0; i--) {
        suma += Number(String(cuerpo)[i]) * multiplo;
        multiplo = multiplo === 7 ? 2 : multiplo + 1;
    }
    const resto = 11 - (suma % 11);
    return resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
}

export function rutValido(rut) {
    const limpio = limpiarRut(rut);
    if (!/^\d{7,8}[0-9K]$/.test(limpio)) return false;
    return calcularDv(limpio.slice(0, -1)) === limpio.slice(-1);
}

export const limpiarPasaporte = (valor) => String(valor ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
export const pasaporteValido = (valor) => /^[0-9A-Z]{5,20}$/.test(limpiarPasaporte(valor));

/** Normaliza y valida según el tipo. Devuelve el documento limpio o null si no es válido. */
export function documentoNormalizado(tipo, valor) {
    if (esDocumentoExtranjero(tipo)) return pasaporteValido(valor) ? limpiarPasaporte(valor) : null;
    return rutValido(valor) ? limpiarRut(valor) : null;
}

/** "Pasaporte AB1234567", "DNI 30123456" o "RUT 12.345.678-9" (para PDF y correos). */
export function textoDocumento(tipo, valor) {
    if (esDocumentoExtranjero(tipo)) return `${ETIQUETAS_DOCUMENTO[tipo]} ${limpiarPasaporte(valor)}`;
    const limpio = limpiarRut(valor);
    if (!rutValido(limpio)) return `RUT ${String(valor ?? "").trim()}`;
    return `RUT ${limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${limpio.slice(-1)}`;
}
