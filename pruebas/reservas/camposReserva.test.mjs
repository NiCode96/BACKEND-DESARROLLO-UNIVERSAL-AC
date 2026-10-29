// Pruebas de las reglas de previsión y comentario de la reserva.
// Correr con: npm run test:reservas
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    VALOR_NO_INDICADO,
    normalizarPrevisionReserva,
    normalizarComentarioReserva,
    leerCamposOpcionalesReserva,
    calcularDistribucionPrevision,
    esFechaCivilValida,
    CODIGO_PREVISION_INVALIDA,
    CODIGO_COMENTARIO_INVALIDO,
} from "../../services/camposReserva.js";

const conCodigo = (codigo) => (error) => error?.code === codigo;

test("previsión vacía o ausente queda 'No indicado'", () => {
    for (const valor of [undefined, null, "", "   ", "No indicado", "NO INDICADA", "no indicado"]) {
        assert.equal(normalizarPrevisionReserva(valor), VALOR_NO_INDICADO, String(valor));
    }
});

test("previsión del catálogo se guarda en su forma canónica", () => {
    assert.equal(normalizarPrevisionReserva("FONASA"), "FONASA");
    assert.equal(normalizarPrevisionReserva(" isapre "), "ISAPRE");
    assert.equal(normalizarPrevisionReserva("Sin Previsión"), "SIN PREVISION");
    assert.equal(normalizarPrevisionReserva("dipreca"), "DIPRECA");
    assert.equal(normalizarPrevisionReserva("Particular"), "PARTICULAR");
});

test("previsión fuera del catálogo o de otro tipo se rechaza", () => {
    for (const valor of ["BANMEDICA", "FONASA'; DROP TABLE x;--", "ISAPRE CONSALUD", 1, {}, ["FONASA"]]) {
        assert.throws(() => normalizarPrevisionReserva(valor), conCodigo(CODIGO_PREVISION_INVALIDA), String(valor));
    }
});

test("comentario vacío o ausente queda 'No indicado'", () => {
    for (const valor of [undefined, null, "", "  \n\t ", "No indicado"]) {
        assert.equal(normalizarComentarioReserva(valor), VALOR_NO_INDICADO, JSON.stringify(valor));
    }
});

test("comentario se limpia: sin saltos de línea ni caracteres de control", () => {
    assert.equal(normalizarComentarioReserva("  Trae exámenes  "), "Trae exámenes");
    assert.equal(normalizarComentarioReserva("línea 1\r\nlínea 2"), "línea 1 línea 2");
    assert.equal(normalizarComentarioReserva("a\u0000b​c d"), "a b c d");
});

test("comentario respeta el límite de 100 caracteres reales", () => {
    assert.equal(normalizarComentarioReserva("a".repeat(100)).length, 100);
    assert.throws(() => normalizarComentarioReserva("a".repeat(101)), conCodigo(CODIGO_COMENTARIO_INVALIDO));
    // 100 emojis = 200 unidades UTF-16 pero 100 caracteres: cabe en VARCHAR(100).
    assert.equal([...normalizarComentarioReserva("🙂".repeat(100))].length, 100);
    assert.throws(() => normalizarComentarioReserva(42), conCodigo(CODIGO_COMENTARIO_INVALIDO));
});

test("al crear, los campos ausentes valen 'No indicado'", () => {
    assert.deepEqual(leerCamposOpcionalesReserva({}), { prevision: VALOR_NO_INDICADO, comentario: VALOR_NO_INDICADO });
    assert.deepEqual(
        leerCamposOpcionalesReserva({ prevision: "fonasa", comentario: "Control" }),
        { prevision: "FONASA", comentario: "Control" }
    );
});

test("al actualizar, ausente = no tocar (null) y vacío = limpiar", () => {
    assert.deepEqual(leerCamposOpcionalesReserva({}, { esActualizacion: true }), { prevision: null, comentario: null });
    assert.deepEqual(
        leerCamposOpcionalesReserva({ prevision: null, comentario: "" }, { esActualizacion: true }),
        { prevision: VALOR_NO_INDICADO, comentario: VALOR_NO_INDICADO }
    );
});

test("fechas civiles: formato y existencia en el calendario", () => {
    for (const ok of ["2026-10-01", "2028-02-29", "2026-12-31"]) assert.ok(esFechaCivilValida(ok), ok);
    for (const malo of ["2026-02-29", "2026-13-01", "2026-10-1", "2026-10-01T00:00:00.000Z", "", null, 20261001]) {
        assert.equal(esFechaCivilValida(malo), false, String(malo));
    }
});

test("distribución del ejemplo del requerimiento", () => {
    const { total, distribucion } = calcularDistribucionPrevision([
        { prevision: "No indicado", cantidad: 10 },
        { prevision: "FONASA", cantidad: 45 },
        { prevision: "ISAPRE", cantidad: 25 },
        { prevision: "SIN PREVISION", cantidad: 20 },
    ]);
    assert.equal(total, 100);
    assert.deepEqual(distribucion, [
        { prevision: "FONASA", cantidad: 45, porcentaje: 45 },
        { prevision: "ISAPRE", cantidad: 25, porcentaje: 25 },
        { prevision: "SIN PREVISION", cantidad: 20, porcentaje: 20 },
        { prevision: "No indicado", cantidad: 10, porcentaje: 10 },
    ]);
});

test("los porcentajes siempre suman exactamente 100", () => {
    const casos = [
        [1, 1, 1],          // 33,3 + 33,3 + 33,3 = 99,9 si se redondea por separado
        [2, 1],
        [1, 1, 1, 1, 1, 1, 1],
        [997, 1, 1, 1],
        [7],
    ];
    for (const cantidades of casos) {
        const filas = cantidades.map((cantidad, i) => ({ prevision: `P${i}`, cantidad }));
        const { total, distribucion } = calcularDistribucionPrevision(filas);
        const sumaDecimas = distribucion.reduce((acc, d) => acc + Math.round(d.porcentaje * 10), 0);
        assert.equal(sumaDecimas, 1000, cantidades.join(","));
        assert.equal(distribucion.reduce((acc, d) => acc + d.cantidad, 0), total);
    }
});

test("sin reservas en el período: total 0 y sin división por cero", () => {
    assert.deepEqual(calcularDistribucionPrevision([]), { total: 0, distribucion: [] });
    assert.deepEqual(calcularDistribucionPrevision([{ prevision: "FONASA", cantidad: 0 }]), { total: 0, distribucion: [] });
});

test("filas con previsión nula se agrupan en 'No indicado'", () => {
    const { distribucion } = calcularDistribucionPrevision([
        { prevision: null, cantidad: 2 },
        { prevision: "No indicado", cantidad: 3 },
    ]);
    assert.deepEqual(distribucion, [{ prevision: VALOR_NO_INDICADO, cantidad: 5, porcentaje: 100 }]);
});
