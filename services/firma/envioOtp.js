/* Envío del código OTP al paciente (consentimiento informado).
 *  - WhatsApp por Twilio: el mismo número que envía confirmaciones y recordatorios
 *    (TWILIO_WHATSAPP_FROM) con la plantilla de AUTENTICACIÓN aprobada por Meta
 *    (TWILIO_CONTENT_SID_OTP). Meta exige esa categoría para códigos: mandarlos en
 *    una plantilla de utilidad la pausaría junto con las de citas.
 *  - SMS por Twilio (opcional): requiere TWILIO_SMS_FROM, un número habilitado para SMS.
 *  - Correo por Brevo (correoFirma.js).
 * El mensaje solo lleva el código, la clínica y el vencimiento: nunca el
 * procedimiento ni datos de salud (Ley 21.719). */

import twilio from "twilio";
import { enviarCorreo, htmlCodigoOtp } from "./correoFirma.js";

let cliente = null;
function clienteTwilio() {
    if (!cliente && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        cliente = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, { timeout: 10000 });
    }
    return cliente;
}

/** "9 1234 5678" / "+56912345678" / "56912345678" → "+56912345678". */
export function telefonoE164(telefono) {
    const digitos = String(telefono || "").replace(/\D/g, "");
    if (digitos.length === 9 && digitos.startsWith("9")) return `+56${digitos}`;
    if (digitos.length === 11 && digitos.startsWith("56")) return `+${digitos}`;
    return digitos.length >= 8 ? `+${digitos}` : null;
}

/** true si el canal WhatsApp está configurado en esta instancia. */
export const whatsappOtpDisponible = () =>
    Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM && process.env.TWILIO_CONTENT_SID_OTP);

export async function enviarCodigoOtp({ canal, destino, codigo, empresa }) {
    const clinica = empresa?.empresaNombre || "tu centro de salud";
    if (canal === "whatsapp") {
        const twilioCliente = clienteTwilio();
        const para = telefonoE164(destino);
        if (!twilioCliente || !whatsappOtpDisponible() || !para) {
            console.error("[FIRMA] WhatsApp OTP no configurado (TWILIO_CONTENT_SID_OTP) o teléfono inválido");
            return false;
        }
        const desde = process.env.TWILIO_WHATSAPP_FROM.replace(/^whatsapp:/, "");
        // La plantilla de autenticación solo recibe el código ({{1}}): Meta pone el
        // texto, el aviso de seguridad, el vencimiento y el botón "Copiar código".
        await twilioCliente.messages.create({
            from: `whatsapp:${desde.startsWith("+") ? desde : `+${desde}`}`,
            to: `whatsapp:${para}`,
            contentSid: process.env.TWILIO_CONTENT_SID_OTP,
            contentVariables: JSON.stringify({ 1: codigo }),
        });
        return true;
    }
    if (canal === "sms") {
        const twilioCliente = clienteTwilio();
        const para = telefonoE164(destino);
        if (!twilioCliente || !process.env.TWILIO_SMS_FROM || !para) {
            console.error("[FIRMA] SMS no configurado (TWILIO_SMS_FROM) o teléfono inválido");
            return false;
        }
        await twilioCliente.messages.create({
            from: process.env.TWILIO_SMS_FROM,
            to: para,
            body: `${clinica}: tu código para aceptar el consentimiento es ${codigo}. Vence en 10 minutos. No lo compartas.`,
        });
        return true;
    }
    return enviarCorreo({
        empresa, para: destino,
        asunto: `Tu código de verificación - ${clinica}`,
        html: htmlCodigoOtp({ empresa, codigo }),
    });
}
