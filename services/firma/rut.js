/* Validación de documentos de identidad (misma regla que src/lib/rut.js del front).
 *  - RUT chileno: dígito verificador por módulo 11.
 *  - Pasaporte: 5 a 20 caracteres alfanuméricos (pacientes extranjeros). */

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
    if (tipo === "pasaporte") return pasaporteValido(valor) ? limpiarPasaporte(valor) : null;
    return rutValido(valor) ? limpiarRut(valor) : null;
}
