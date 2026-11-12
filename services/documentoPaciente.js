/*
    documentoPaciente.js
    Tipo y número del documento de identidad de un paciente: RUT, pasaporte o DNI.

    Todos los endpoints que crean o editan un paciente o una reserva pasan por aquí
    (mismo criterio que services/camposReserva.js):
      - Un tipo desconocido se RECHAZA (no se corrige en silencio a "rut").
      - Pasaporte y DNI se validan y se guardan limpios (5 a 20 letras o números).
      - El RUT se guarda tal como llega, igual que antes de este cambio: los formularios
        ya validan el dígito verificador y hay reservas antiguas que deben poder editarse.

    Funciones puras, sin base de datos: se prueban en pruebas/pacientes/.
*/
import { TIPOS_DOCUMENTO, documentoNormalizado, esDocumentoExtranjero } from "./firma/rut.js";

export const CODIGO_TIPO_DOCUMENTO_INVALIDO = "TIPO_DOCUMENTO_INVALIDO";
export const CODIGO_DOCUMENTO_INVALIDO = "DOCUMENTO_INVALIDO";

function crearErrorCampo(codigo, mensaje) {
    const error = new Error(mensaje);
    error.code = codigo;
    return error;
}

/**
 * Lee tipo_documento y el número (campo `rut`) del body.
 *
 * Al CREAR, un tipo ausente vale "rut" (clientes que no conocen el campo).
 * Al ACTUALIZAR, un tipo ausente vale null = "no tocar lo guardado" (COALESCE en el modelo).
 * Devuelve { tipo_documento, rut } con el número normalizado si es extranjero.
 */
export function leerDocumentoPaciente(body = {}, { campoNumero = "rut", esActualizacion = false } = {}) {
    const tiene = Object.prototype.hasOwnProperty.call(body ?? {}, "tipo_documento");
    const crudo = body?.tipo_documento;
    const numero = body?.[campoNumero];

    if (!tiene || crudo === null || crudo === "") {
        return { tipo_documento: esActualizacion ? null : "rut", rut: numero };
    }
    if (typeof crudo !== "string" || !TIPOS_DOCUMENTO.includes(crudo)) {
        throw crearErrorCampo(CODIGO_TIPO_DOCUMENTO_INVALIDO, "El tipo de documento no es válido.");
    }
    if (!esDocumentoExtranjero(crudo)) return { tipo_documento: crudo, rut: numero };

    const limpio = documentoNormalizado(crudo, numero);
    if (!limpio) {
        throw crearErrorCampo(CODIGO_DOCUMENTO_INVALIDO, "El documento debe tener entre 5 y 20 letras o números.");
    }
    return { tipo_documento: crudo, rut: limpio };
}

/** Mensaje de respuesta para un error de leerDocumentoPaciente (null si es otro error). */
export function mensajeErrorDocumento(error) {
    if (error?.code === CODIGO_TIPO_DOCUMENTO_INVALIDO) return "tipo-documento-invalido";
    if (error?.code === CODIGO_DOCUMENTO_INVALIDO) return "documento-invalido";
    return null;
}
