import twilio from 'twilio';
import { construirEnlacesReservaToken } from './notificacionReservaToken.js';
import { obtenerDatosEmpresaConfig } from './datosEmpresaConfig.js';

/**
 * SERVICIO DE NOTIFICACIONES WHATSAPP VÍA TWILIO (TEMPLATE APROBADO)
 *
 * Envía mensajes usando contentSid + contentVariables.
 * Requiere variables de entorno:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_WHATSAPP_FROM  (ej: +12605537594)
 * - TWILIO_CONTENT_SID    (ej: HX0b7bd1b24b7822c0f8b92d6408947e6c)
 * - TWILIO_TEMPLATE_BUTTON_MODE
 *   - quick_reply: usa payloads en botones de respuesta
 *   - url_buttons: usa botones que abren URL
 *   - text_links: envía los links dentro del cuerpo del template
 * Los datos de nombre, direccion y telefono de la empresa vienen desde datos_empresa.
 */

/**
 * Formatea el teléfono al formato internacional de Chile para WhatsApp.
 * Acepta: 912345678, +56912345678, 56912345678, 0912345678
 */
function formatearTelefonoWhatsApp(telefono) {
    if (!telefono) return null;

    if (String(telefono).startsWith("whatsapp:")) {
        return String(telefono);
    }

    let limpio = telefono.replace(/[\s\-\(\)\.]/g, '');

    if (limpio.startsWith('+')) {
        return `whatsapp:${limpio}`;
    }

    if (limpio.startsWith('56') && limpio.length >= 11) {
        return `whatsapp:+${limpio}`;
    }

    if (limpio.startsWith('0')) {
        limpio = limpio.substring(1);
    }

    if (limpio.length === 9 && limpio.startsWith('9')) {
        return `whatsapp:+56${limpio}`;
    }

    return `whatsapp:+56${limpio}`;
}

function construirEnlacesReserva({ id_reserva, nombre, apellido, fecha, hora }) {
    return construirEnlacesReservaToken({
        id_reserva,
        nombrePaciente: nombre,
        apellidoPaciente: apellido,
        fechaInicio: fecha,
        horaInicio: hora
    });
}

function construirPayloadsReserva({ id_reserva }) {
    if (!id_reserva) {
        return { payloadConfirmar: "", payloadCancelar: "" };
    }

    return {
        payloadConfirmar: `CONFIRMAR_RESERVA:${id_reserva}`,
        payloadCancelar: `CANCELAR_RESERVA:${id_reserva}`
    };
}

/**
 * Envía un mensaje de WhatsApp usando el template aprobado de Twilio.
 *
 * @param {Object} params
 * @param {string} params.telefono  - Teléfono del paciente
 * @param {string} params.nombre    - Nombre del paciente
 * @param {string} params.clinica   - Nombre de la clínica (opcional, usa datos_empresa)
 * @param {string} params.fecha     - Fecha de la cita (ej: "Lunes 28 de Julio 2025")
 * @param {string} params.hora      - Hora de la cita (ej: "10:30")
 * @returns {Promise<boolean>} true si se envió correctamente
 */


{/*
FUNCION QUE ENVIA UN MENSAJE DE WSP INGRESO Y NOTIFICACION DEL AGENDAMIENTO REALIZADO
*/}

export async function notificacionAgendamiento({ telefono, nombre, apellido, nombreProfesional, motivo_reserva, clinica, fecha, hora, id_reserva }) {
    const {
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN,
        TWILIO_WHATSAPP_FROM,
        TWILIO_CONTENT_SID
    } = process.env;
    const { nombreEmpresa, direccionEmpresa, telefonoEmpresa } = await obtenerDatosEmpresaConfig();

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        console.warn("[WSP] Credenciales de Twilio no configuradas. Mensaje no enviado.");
        return false;
    }

    if(!direccionEmpresa){
        console.warn(`[DATOS_EMPRESA] direccion no configurada`);
        return false;
    }

    if (!telefonoEmpresa) {
        console.warn(`[DATOS_EMPRESA] telefono no configurado`);
        return false;
    }

    if (!TWILIO_WHATSAPP_FROM) {
        console.warn("[WSP] TWILIO_WHATSAPP_FROM no configurado. Mensaje no enviado.");
        return false;
    }

    if (!TWILIO_CONTENT_SID) {
        console.warn("[WSP] TWILIO_CONTENT_SID no configurado. Mensaje no enviado.");
        return false;
    }

    if (!telefono) {
        console.warn("[WSP] Teléfono vacío. Mensaje no enviado.");
        return false;
    }

    const destinatario = formatearTelefonoWhatsApp(telefono);
    if (!destinatario) {
        console.warn("[WSP] No se pudo formatear el teléfono:", telefono);
        return false;
    }

    const nombreClinica = clinica || nombreEmpresa || "la clínica";
    const fromNumber = TWILIO_WHATSAPP_FROM.startsWith('+')
        ? TWILIO_WHATSAPP_FROM
        : `+${TWILIO_WHATSAPP_FROM}`;
    const { urlConfirmar, urlCancelar } = construirEnlacesReserva({
        id_reserva,
        nombre,
        apellido,
        fecha,
        hora
    });
    const { payloadConfirmar, payloadCancelar } = construirPayloadsReserva({ id_reserva });
    const buttonMode = String(process.env.TWILIO_TEMPLATE_BUTTON_MODE || "quick_reply").toLowerCase();
    let contentVariables;

    // Orden real del template Twilio aprobado:
    // 1 nombre paciente, 2 clinica, 3 fecha, 4 hora,
    // 5 direccion, 6 telefono, 7 profesional, 8 motivo,
    // 9 confirmar, 10 anular.
    if (buttonMode === "url_buttons") {
        contentVariables = {
            1: nombre,
            2: nombreClinica,
            3: fecha,
            4: hora,
            5: direccionEmpresa,
            6: telefonoEmpresa,
            7: nombreProfesional || "",
            8: motivo_reserva || "",
            9: id_reserva ? String(id_reserva) : "",
            10: id_reserva ? String(id_reserva) : "",
        };
    } else if (buttonMode === "text_links") {
        contentVariables = {
            1: nombre,
            2: nombreClinica,
            3: fecha,
            4: hora,
            5: direccionEmpresa,
            6: telefonoEmpresa,
            7: nombreProfesional || "",
            8: motivo_reserva || "",
            9: urlConfirmar || "",
            10: urlCancelar || "",
        };
    } else {
        contentVariables = {
            1: nombre,
            2: nombreClinica,
            3: fecha,
            4: hora,
            5: direccionEmpresa,
            6: telefonoEmpresa,
            7: nombreProfesional || "",
            8: motivo_reserva || "",
            9: payloadConfirmar,
            10: payloadCancelar,
            11: urlConfirmar || "",
            12: urlCancelar || "",
        };
    }

    try {
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

        console.log("[WSP] buttonMode:", buttonMode);

        await client.messages.create({
            from: `whatsapp:${fromNumber}`,
            to: destinatario,
            contentSid: TWILIO_CONTENT_SID,
            contentVariables: JSON.stringify(contentVariables)
        });

        console.log(`[WSP] Mensaje enviado a ${destinatario} (${nombre} - ${fecha} ${hora})`);
        return true;
    } catch (error) {
        console.error("[WSP] Error al enviar mensaje:", error.message);
        return false;
    }
}

export async function notificacionActualizacionAgendamiento({
    telefono,
    nombre,
    apellido,
    nombreProfesional,
    motivo_reserva,
    clinica,
    fecha,
    hora,
    id_reserva
}) {
    const enviado = await notificacionAgendamiento({
        telefono,
        nombre,
        apellido,
        nombreProfesional,
        motivo_reserva,
        clinica,
        fecha,
        hora,
        id_reserva
    });
    if (enviado) {
        console.log(`[WSP] Notificación de actualización enviada a ${nombre} (${fecha} ${hora})`);
    }
    return enviado;
}

export async function enviarMensajeTextoWhatsApp({ telefono, mensaje }) {
    const {
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN,
        TWILIO_WHATSAPP_FROM
    } = process.env;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
        console.warn("[WSP] Configuración incompleta para enviar mensaje de respuesta.");
        return false;
    }

    if (!telefono || !mensaje) {
        console.warn("[WSP] Faltan telefono o mensaje para la respuesta por WhatsApp.");
        return false;
    }

    const destinatario = formatearTelefonoWhatsApp(telefono);
    if (!destinatario) {
        console.warn("[WSP] No se pudo formatear el teléfono:", telefono);
        return false;
    }

    const fromNumber = TWILIO_WHATSAPP_FROM.startsWith('+')
        ? TWILIO_WHATSAPP_FROM
        : `+${TWILIO_WHATSAPP_FROM}`;

    try {
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        await client.messages.create({
            from: `whatsapp:${fromNumber}`,
            to: destinatario,
            body: mensaje
        });
        return true;
    } catch (error) {
        console.error("[WSP] Error al enviar respuesta por WhatsApp:", error.message);
        return false;
    }
}




{/*
FUNCION QUE ENVIA UN MENSAJE DE WSP DESDE LA API DE TWILO UNA HORA ANTES
*/}

export async function enviarRecordatorio_1hora({ telefono, nombre, clinica, fecha, hora }) {
    const {
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN,
        TWILIO_WHATSAPP_FROM,
        TWILIO_CONTENT_SID_RECORDATORIO,
    } = process.env;
    const { nombreEmpresa, direccionEmpresa, telefonoEmpresa } = await obtenerDatosEmpresaConfig();

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        console.warn("[WSP] Credenciales de Twilio no configuradas. Mensaje no enviado.");
        return false;
    }

    if (!telefonoEmpresa) {
        console.warn(`[DATOS_EMPRESA], telefono empresa no configurado. Mensaje no enviado.`);
        return false;
    }

    if (!direccionEmpresa) {
        console.warn(`[DATOS_EMPRESA], direccion no configurada. Mensaje no enviado.`);
        return false;
    }

    if (!TWILIO_WHATSAPP_FROM) {
        console.warn("[WSP] TWILIO_WHATSAPP_FROM no configurado. Mensaje no enviado.");
        return false;
    }

    if (!TWILIO_CONTENT_SID_RECORDATORIO) {
        console.warn("[WSP] TWILIO_CONTENT_SID_RECORDATORIO no configurado. Mensaje no enviado.");
        return false;
    }

    if (!telefono) {
        console.warn("[WSP] Teléfono vacío. Mensaje no enviado.");
        return false;
    }

    const destinatario = formatearTelefonoWhatsApp(telefono);
    if (!destinatario) {
        console.warn("[WSP] No se pudo formatear el teléfono:", telefono);
        return false;
    }

    const nombreClinica = clinica || nombreEmpresa || "la clínica";
    const fromNumber = TWILIO_WHATSAPP_FROM.startsWith('+')
        ? TWILIO_WHATSAPP_FROM
        : `+${TWILIO_WHATSAPP_FROM}`;

    try {
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

        await client.messages.create({
            from: `whatsapp:${fromNumber}`,
            to: destinatario,
            contentSid: TWILIO_CONTENT_SID_RECORDATORIO,
            contentVariables: JSON.stringify({
                1: nombre,
                2: nombreClinica,
                3: fecha,
                4: hora,
                5: direccionEmpresa,
                6: telefonoEmpresa
            })
        });

        console.log(`[WSP] Mensaje enviado a ${destinatario} (${nombre} - ${fecha} ${hora})`);
        return true;
    } catch (error) {
        console.error("[WSP] Error al enviar mensaje:", error.message);
        return false;
    }
}
