import assert from "node:assert/strict";
import { test } from "node:test";
import { CODIGO_CATEGORIA_INVALIDA, SIN_CAMBIO, normalizarCategoriaProfesional as n } from "../../services/categoriaProfesional.js";

const invalida = (v) => assert.throws(() => n(v), (e) => e.code === CODIGO_CATEGORIA_INVALIDA, String(v));

test("undefined = no vino: se conserva lo guardado", () => {
    assert.equal(n(undefined), SIN_CAMBIO);
});

test("vacío o null = NULL", () => {
    for (const v of ["", "   ", "\n\t", null]) assert.equal(n(v), null);
});

test("limpia espacios y saltos; acepta nombres chilenos reales", () => {
    assert.equal(n("  Odontología \n general "), "Odontología general");
    for (const v of ["Técnico en enfermería (TENS)", "Ginecología y obstetricia", "Kinesiología de piso pélvico", "Inmunología y alergias", "Ñuble Kine & Salud / Adultos", "Cirugía maxilofacial", "Atención 24/7", "Medicina +60"]) {
        assert.equal(n(v), v);
    }
});

test("rechaza HTML, inyección, tipos raros y largo excesivo", () => {
    for (const v of ["<script>alert(1)</script>", "Odonto'; DROP TABLE profesionales;--", "a\"b", "x{y}", "https://malo.com", "a".repeat(61), 42, {}, ["Odontología"], true]) {
        invalida(v);
    }
    assert.equal(n("a".repeat(60)).length, 60);
});
