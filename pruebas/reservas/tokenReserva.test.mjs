/* Enlaces de confirmar/cancelar cita (services/notificacionReservaToken.js).
 *   node --test pruebas/reservas/tokenReserva.test.mjs */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { generarTokenReserva, verificarTokenReserva, construirEnlacesReservaToken } from "../../services/notificacionReservaToken.js";

beforeEach(() => {
    process.env.NOTIFICACION_TOKEN_SECRET = "clave-de-prueba-solo-para-tests";
    delete process.env.TWILIO_AUTH_TOKEN;
    process.env.BACKEND_URL = "https://back.prueba.cl/";
});

test("ida y vuelta: el token firmado devuelve la misma reserva", () => {
    const token = generarTokenReserva({ id_reserva: 4321 });
    assert.deepEqual(verificarTokenReserva(token), { id_reserva: 4321 });
});

test("una firma alterada, de otra reserva o de otra clave no sirve", () => {
    const token = generarTokenReserva({ id_reserva: 4321 });
    const [id, firma] = token.split(".");
    assert.equal(verificarTokenReserva(`${id}.${firma.slice(0, -1)}${firma.at(-1) === "A" ? "B" : "A"}`), null);
    assert.equal(verificarTokenReserva(`${(4322).toString(36)}.${firma}`), null);
    assert.equal(verificarTokenReserva(`${id}.corta`), null);
    process.env.NOTIFICACION_TOKEN_SECRET = "otra-clave";
    assert.equal(verificarTokenReserva(token), null);
});

test("sin ninguna clave no se generan ni aceptan enlaces (nunca se firma con algo público)", () => {
    const token = generarTokenReserva({ id_reserva: 4321 });
    delete process.env.NOTIFICACION_TOKEN_SECRET;
    assert.equal(generarTokenReserva({ id_reserva: 4321 }), null);
    assert.equal(verificarTokenReserva(token), null);
    assert.deepEqual(construirEnlacesReservaToken({ id_reserva: 4321 }), { token: null, urlConfirmar: null, urlCancelar: null });
});

test("migración: al configurar NOTIFICACION_TOKEN_SECRET siguen sirviendo los enlaces firmados con TWILIO_AUTH_TOKEN", () => {
    delete process.env.NOTIFICACION_TOKEN_SECRET;
    process.env.TWILIO_AUTH_TOKEN = "token-twilio-de-prueba";
    const antiguo = generarTokenReserva({ id_reserva: 77 });
    assert.deepEqual(verificarTokenReserva(antiguo), { id_reserva: 77 });

    process.env.NOTIFICACION_TOKEN_SECRET = "clave-propia-nueva";
    const nuevo = generarTokenReserva({ id_reserva: 77 });
    assert.notEqual(nuevo, antiguo, "lo nuevo se firma con la clave propia");
    assert.deepEqual(verificarTokenReserva(nuevo), { id_reserva: 77 });
    assert.deepEqual(verificarTokenReserva(antiguo), { id_reserva: 77 }, "lo ya enviado sigue sirviendo");
});

test("enlaces: usan BACKEND_URL (sin la barra final) y sin ella no hay enlaces", () => {
    const { urlConfirmar, urlCancelar, token } = construirEnlacesReservaToken({ id_reserva: 9 });
    assert.equal(urlConfirmar, `https://back.prueba.cl/notificacion/confirmar/${token}`);
    assert.equal(urlCancelar, `https://back.prueba.cl/notificacion/cancelar/${token}`);
    delete process.env.BACKEND_URL;
    assert.deepEqual(construirEnlacesReservaToken({ id_reserva: 9 }), { token: null, urlConfirmar: null, urlCancelar: null });
});
