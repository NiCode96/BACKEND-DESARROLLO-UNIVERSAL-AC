// Pruebas del tipo de documento del paciente (RUT, pasaporte, DNI).
// Correr con: node --test pruebas/pacientes/documentoPaciente.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    leerDocumentoPaciente,
    mensajeErrorDocumento,
    CODIGO_DOCUMENTO_INVALIDO,
    CODIGO_TIPO_DOCUMENTO_INVALIDO,
} from "../../services/documentoPaciente.js";
import { documentoNormalizado, textoDocumento } from "../../services/firma/rut.js";

const conCodigo = (codigo) => (error) => error?.code === codigo;

test("sin tipo: al crear es RUT (clientes antiguos); al actualizar no toca lo guardado", () => {
    assert.deepEqual(leerDocumentoPaciente({ rut: "191685879" }), { tipo_documento: "rut", rut: "191685879" });
    assert.deepEqual(leerDocumentoPaciente({ rut: "191685879", tipo_documento: "" }), { tipo_documento: "rut", rut: "191685879" });
    assert.deepEqual(leerDocumentoPaciente({ rut: "191685879" }, { esActualizacion: true }), { tipo_documento: null, rut: "191685879" });
});

test("RUT: se guarda como llega (igual que antes; el formulario ya valida el dígito)", () => {
    assert.deepEqual(leerDocumentoPaciente({ rut: "19.168.587-9", tipo_documento: "rut" }), { tipo_documento: "rut", rut: "19.168.587-9" });
});

test("pasaporte y DNI se validan y se guardan limpios", () => {
    assert.deepEqual(leerDocumentoPaciente({ rut: " ab-123 4567 ", tipo_documento: "pasaporte" }), { tipo_documento: "pasaporte", rut: "AB1234567" });
    assert.deepEqual(leerDocumentoPaciente({ rut: "30.123.456", tipo_documento: "dni" }), { tipo_documento: "dni", rut: "30123456" });
    assert.deepEqual(leerDocumentoPaciente({ documento: "y1234567z", tipo_documento: "dni" }, { campoNumero: "documento" }), { tipo_documento: "dni", rut: "Y1234567Z" });
});

test("documento extranjero inválido se rechaza", () => {
    for (const rut of ["", "123", "A".repeat(21), undefined]) {
        assert.throws(() => leerDocumentoPaciente({ rut, tipo_documento: "dni" }), conCodigo(CODIGO_DOCUMENTO_INVALIDO), String(rut));
    }
});

test("tipo desconocido se rechaza (no se corrige en silencio)", () => {
    for (const tipo of ["cedula", "RUT", "Pasaporte", 3, {}, ["dni"]]) {
        assert.throws(() => leerDocumentoPaciente({ rut: "AB12345", tipo_documento: tipo }), conCodigo(CODIGO_TIPO_DOCUMENTO_INVALIDO), JSON.stringify(tipo));
    }
});

test("mensajes de respuesta", () => {
    assert.equal(mensajeErrorDocumento({ code: CODIGO_DOCUMENTO_INVALIDO }), "documento-invalido");
    assert.equal(mensajeErrorDocumento({ code: CODIGO_TIPO_DOCUMENTO_INVALIDO }), "tipo-documento-invalido");
    assert.equal(mensajeErrorDocumento(new Error("otra cosa")), null);
});

test("texto para PDF y correos: cada documento con su nombre", () => {
    assert.equal(textoDocumento("pasaporte", "ab1234567"), "Pasaporte AB1234567");
    assert.equal(textoDocumento("dni", "30.123.456"), "DNI 30123456");
    assert.equal(textoDocumento("rut", "191695879"), "RUT 19.169.587-9");
    assert.equal(textoDocumento("rut", "12345"), "RUT 12345", "un RUT malo no se deforma");
    assert.equal(documentoNormalizado("dni", "30123456"), "30123456");
    assert.equal(documentoNormalizado("rut", "191685870"), null);
});
