import crypto from "crypto";

// Claves de los enlaces de confirmar/cancelar cita. Se FIRMA con NOTIFICACION_TOKEN_SECRET,
// propia de cada instancia (scripts/revisar_env.mjs la exige). Se ACEPTA además lo firmado
// con TWILIO_AUTH_TOKEN, que era la clave de hecho cuando faltaba la propia: así los enlaces
// ya enviados siguen sirviendo al configurar NOTIFICACION_TOKEN_SECRET. Antes del 14-11 había
// también una clave fija escrita aquí: con el repo a la vista se podían fabricar enlaces de
// cancelar para cualquier reserva. Sin clave no se generan enlaces (nunca se firma con algo
// público).
function clavesVigentes() {
    return [...new Set([process.env.NOTIFICACION_TOKEN_SECRET, process.env.TWILIO_AUTH_TOKEN].filter(Boolean))];
}

function base64UrlEncode(valor) {
    return Buffer.from(valor, "utf8").toString("base64url");
}

function base64UrlDecode(valor) {
    return Buffer.from(valor, "base64url").toString("utf8");
}

function firmarPayload(payloadCodificado, secret) {
    return crypto
        .createHmac("sha256", secret)
        .update(payloadCodificado)
        .digest("base64url")
        .slice(0, 22);
}

const firmasIguales = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function generarTokenReserva({
    id_reserva,
}) {
    if (!id_reserva) {
        return null;
    }

    const idCodificado = Number(id_reserva).toString(36);
    const [clave] = clavesVigentes();
    if (!clave) {
        console.error("[RESERVA] sin NOTIFICACION_TOKEN_SECRET: el aviso sale sin enlaces de confirmar/cancelar");
        return null;
    }
    return `${idCodificado}.${firmarPayload(idCodificado, clave)}`;
}

export function verificarTokenReserva(token) {
    if (!token || typeof token !== "string" || !token.includes(".")) {
        return null;
    }

    const [payloadCodificado, firma] = token.split(".");
    if (!payloadCodificado || !firma) {
        return null;
    }

    if (!clavesVigentes().some((clave) => firmasIguales(firma, firmarPayload(payloadCodificado, clave)))) {
        return null;
    }

    const id_reserva = parseInt(payloadCodificado, 36);
    if (!Number.isInteger(id_reserva) || id_reserva <= 0) {
        return null;
    }

    return { id_reserva };
}

export function construirEnlacesReservaToken({
    id_reserva,
    nombrePaciente,
    apellidoPaciente,
    fechaInicio,
    horaInicio
}) {
    const token = generarTokenReserva({
        id_reserva,
        nombrePaciente,
        apellidoPaciente,
        fechaInicio,
        horaInicio
    });

    if (!token) {
        return { token: null, urlConfirmar: null, urlCancelar: null };
    }

    // Sin BACKEND_URL no hay enlaces: antes caía a la URL de otro cliente.
    const baseUrl = String(process.env.BACKEND_URL || "").trim().replace(/\/$/, "");
    if (!baseUrl) {
        console.error("[RESERVA] sin BACKEND_URL: el aviso sale sin enlaces de confirmar/cancelar");
        return { token: null, urlConfirmar: null, urlCancelar: null };
    }
    return {
        token,
        urlConfirmar: `${baseUrl}/notificacion/confirmar/${token}`,
        urlCancelar: `${baseUrl}/notificacion/cancelar/${token}`
    };
}

export function resolverDatosReservaDesdeRequest(req) {
    const token = req.params?.token || req.query?.token || req.body?.token || null;
    const datosDesdeToken = verificarTokenReserva(token);
    if (datosDesdeToken) {
        return { ...datosDesdeToken, token };
    }

    const origen = req.method === "GET" ? req.query : req.body;
    const {
        id_reserva,
        nombrePaciente,
        apellidoPaciente,
        fechaInicio,
        horaInicio
    } = origen || {};

    if (!id_reserva || !nombrePaciente || !apellidoPaciente || !fechaInicio || !horaInicio) {
        return null;
    }

    return {
        id_reserva,
        nombrePaciente,
        apellidoPaciente,
        fechaInicio,
        horaInicio,
        token: null
    };
}
