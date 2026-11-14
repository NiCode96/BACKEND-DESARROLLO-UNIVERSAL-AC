/* Pruebas unitarias de la firma electrónica (sin base de datos ni red).
 *   node --test "pruebas/firma/*.test.mjs"
 * Las de tiempo se corren además con varios TZ (ver docs/firma/04, Fase 1):
 *   for tz in America/Santiago UTC Asia/Tokyo Pacific/Niue; do TZ=$tz node --test "pruebas/firma/*.test.mjs"; done */

import { test } from "node:test";
import assert from "node:assert/strict";
import { rutValido, documentoNormalizado, calcularDv } from "../../services/firma/rut.js";
import { formatearSantiagoConOffset } from "../../services/firma/tiempo.js";
import { canonico, sha256, huellasIguales } from "../../services/firma/huellas.js";
import { codigoVerificacion, FORMATO_CODIGO, tokenAceptacion } from "../../services/firma/identificadores.js";
import { limitarEstampado, estadoLimitador } from "../../services/firma/limitador.js";
import { interpolarPlantilla, enmascararCorreo, enmascararTelefono } from "../../services/firma/plantillas.js";
import { esAdministrador, esProfesionalDueno, esRolClinico } from "../../services/firma/roles.js";

test("RUT: módulo 11", () => {
    assert.equal(rutValido("12.345.678-5"), true);
    assert.equal(rutValido("12.345.678-0"), false);
    assert.equal(rutValido("23.456.789-k"), calcularDv("23456789") === "K");
    assert.equal(documentoNormalizado("rut", "19.169.587-9"), "191695879");
    assert.equal(documentoNormalizado("pasaporte", "ab-12 345"), "AB12345");
    assert.equal(documentoNormalizado("pasaporte", "12"), null);
});

test("Fecha con desfase: no depende del TZ del proceso", () => {
    assert.equal(formatearSantiagoConOffset(new Date("2026-01-15T02:59:59.000Z")), "14-01-2026 23:59:59 (UTC-03:00)");
    assert.equal(formatearSantiagoConOffset(new Date("2026-07-15T03:59:59.000Z")), "14-07-2026 23:59:59 (UTC-04:00)");
    assert.equal(formatearSantiagoConOffset(new Date("2027-01-01T02:59:59.000Z")), "31-12-2026 23:59:59 (UTC-03:00)");
    assert.equal(formatearSantiagoConOffset(new Date("2028-03-01T02:00:00.000Z")), "29-02-2028 23:00:00 (UTC-03:00)");
});

test("JSON canónico: el orden de las claves no cambia la huella", () => {
    assert.equal(canonico({ b: 1, a: { d: null, c: [2, 1] } }), '{"a":{"c":[2,1],"d":null},"b":1}');
    assert.equal(sha256(canonico({ x: 1, y: 2 })), sha256(canonico({ y: 2, x: 1 })));
    assert.equal(huellasIguales("ab".repeat(32), "ab".repeat(32)), true);
    assert.equal(huellasIguales("ab".repeat(32), "ac".repeat(32)), false);
});

test("Códigos de verificación y tokens", () => {
    for (let i = 0; i < 200; i++) assert.match(codigoVerificacion(), FORMATO_CODIGO);
    assert.match(tokenAceptacion(), /^ca_[0-9a-f]{32}$/);
});

test("Limitador: nunca más de 2 a la vez; con la cola llena responde servicioOcupado", async () => {
    let maximo = 0;
    const tarea = () => limitarEstampado(async () => {
        maximo = Math.max(maximo, estadoLimitador().activos);
        await new Promise((r) => setTimeout(r, 20));
    });
    const resultados = await Promise.allSettled(Array.from({ length: 15 }, tarea));
    assert.equal(maximo, 2);
    assert.equal(resultados.filter((r) => r.status === "rejected" && r.reason.codigo === "servicioOcupado").length, 3);
});

test("Textos: interpolación y datos enmascarados", () => {
    assert.equal(interpolarPlantilla("{{empresa.nombre}} / {{profesional.nombre}}", { empresa: { empresaNombre: "Clínica X" } }), "Clínica X / el profesional seleccionado");
    assert.equal(enmascararCorreo("paciente@correo.cl"), "p••••••e@correo.cl");
    assert.equal(enmascararTelefono("+56 9 1234 5678"), "+56 9 •••• 5678");
});

test("Roles: mismos criterios que el front", () => {
    assert.equal(esAdministrador({ rol: "tecnico-nativecode" }), true);
    assert.equal(esAdministrador({ rol: "administrador-clinico" }), true);
    assert.equal(esAdministrador({ rol: "profesional-odontologo+admin" }), true);
    assert.equal(esAdministrador({ rol: "profesional-odontologo" }), false);
    assert.equal(esAdministrador({ rol: "" }), false);
    assert.equal(esRolClinico({ rol: "recepcion" }), false);
    assert.equal(esProfesionalDueno({ idProfesional: 46 }, "46"), true);
    assert.equal(esProfesionalDueno({ idProfesional: null }, 46), false);
});
