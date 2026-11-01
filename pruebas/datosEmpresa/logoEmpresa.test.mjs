import assert from "node:assert/strict";
import { test } from "node:test";
import {
    CODIGO_EMPRESA_INVALIDA,
    CODIGO_LOGO_INVALIDO,
    MAX_LARGO_ID_LOGO,
    normalizarIdEmpresa,
    normalizarLogoEmpresa,
} from "../../services/logoEmpresa.js";

const lanzaCodigo = (fn, codigo) => assert.throws(fn, (e) => e.code === codigo);

test("acepta ids reales de Cloudflare Images", () => {
    assert.equal(normalizarLogoEmpresa("4e85bc99-8b27-4e61-244a-49a130200f00"), "4e85bc99-8b27-4e61-244a-49a130200f00");
    assert.equal(normalizarLogoEmpresa("  logo_clinica.v2  "), "logo_clinica.v2");
});

test("vacío o nulo = quitar el logo (NULL)", () => {
    assert.equal(normalizarLogoEmpresa(""), null);
    assert.equal(normalizarLogoEmpresa("   "), null);
    assert.equal(normalizarLogoEmpresa(null), null);
    assert.equal(normalizarLogoEmpresa(undefined), null);
});

test("rechaza URLs y rutas: el logo no puede apuntar fuera de Cloudflare", () => {
    lanzaCodigo(() => normalizarLogoEmpresa("https://sitio-malo.com/logo.png"), CODIGO_LOGO_INVALIDO);
    lanzaCodigo(() => normalizarLogoEmpresa("imagedelivery.net/hash/id/full"), CODIGO_LOGO_INVALIDO);
    lanzaCodigo(() => normalizarLogoEmpresa("../../etc/passwd"), CODIGO_LOGO_INVALIDO);
    lanzaCodigo(() => normalizarLogoEmpresa("javascript:alert(1)"), CODIGO_LOGO_INVALIDO);
});

test("rechaza inyección, espacios internos y tipos raros", () => {
    lanzaCodigo(() => normalizarLogoEmpresa("abc' OR '1'='1"), CODIGO_LOGO_INVALIDO);
    lanzaCodigo(() => normalizarLogoEmpresa("abc def"), CODIGO_LOGO_INVALIDO);
    lanzaCodigo(() => normalizarLogoEmpresa("<script>"), CODIGO_LOGO_INVALIDO);
    lanzaCodigo(() => normalizarLogoEmpresa(123), CODIGO_LOGO_INVALIDO);
    lanzaCodigo(() => normalizarLogoEmpresa({ id: "x" }), CODIGO_LOGO_INVALIDO);
    lanzaCodigo(() => normalizarLogoEmpresa(["x"]), CODIGO_LOGO_INVALIDO);
});

test("respeta el largo máximo de la columna", () => {
    assert.equal(normalizarLogoEmpresa("a".repeat(MAX_LARGO_ID_LOGO)).length, MAX_LARGO_ID_LOGO);
    lanzaCodigo(() => normalizarLogoEmpresa("a".repeat(MAX_LARGO_ID_LOGO + 1)), CODIGO_LOGO_INVALIDO);
});

test("id_empresa entero positivo", () => {
    assert.equal(normalizarIdEmpresa(1), 1);
    assert.equal(normalizarIdEmpresa("7"), 7);
    for (const malo of [0, -1, "0", "1.5", "1 OR 1=1", "", null, undefined, "abc", 1.5]) {
        lanzaCodigo(() => normalizarIdEmpresa(malo), CODIGO_EMPRESA_INVALIDA);
    }
});
