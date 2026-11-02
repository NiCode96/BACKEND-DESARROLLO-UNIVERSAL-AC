/* Correos de la firma electrónica (documentos firmados, constancias y códigos
 * OTP). Mismo patrón que services/envioCotizacionCorreo.js: Brevo, remitente
 * CORREO_REMITENTE, responder-a el correo de la clínica y construirCorreoBase.
 *
 * Ley 21.719 (minimización): el asunto y el cuerpo NUNCA llevan datos clínicos;
 * el contenido va solo en el PDF adjunto. */

import "dotenv/config";
import { construirCorreoBase, construirTablaDetalle, construirBoton, TEXTO_PRINCIPAL, TEXTO_SECUNDARIO } from "../emailTemplateBase.js";

const TIEMPO_LIMITE_MS = 10000;

const escapar = (texto) => String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);

/**
 * @param {object} p
 * @param {object} p.empresa      fila de datos_empresa
 * @param {string} p.para         correo destino
 * @param {string} [p.nombre]     nombre del destinatario
 * @param {string} p.asunto
 * @param {string} p.html         cuerpo (construirCorreoBase)
 * @param {Array<{nombre:string, contenido:Buffer}>} [p.adjuntos]
 * @returns {Promise<boolean>}    true si Brevo aceptó el envío
 */
export async function enviarCorreo({ empresa, para, nombre, asunto, html, adjuntos = [] }) {
    if (!process.env.BREVO_API_KEY || !process.env.CORREO_REMITENTE) {
        console.error("[FIRMA] correo no configurado (BREVO_API_KEY / CORREO_REMITENTE)");
        return false;
    }
    const respuesta = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
        signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
        body: JSON.stringify({
            sender: { name: empresa?.empresaNombre || "Centro de salud", email: process.env.CORREO_REMITENTE },
            to: [{ email: para, ...(nombre ? { name: nombre } : {}) }],
            ...(empresa?.contactoEmail ? { replyTo: { email: empresa.contactoEmail, name: empresa.empresaNombre } } : {}),
            subject: asunto,
            htmlContent: html,
            ...(adjuntos.length
                ? { attachment: adjuntos.map((a) => ({ name: a.nombre, content: a.contenido.toString("base64") })) }
                : {}),
        }),
    });
    if (!respuesta.ok) {
        console.error("[FIRMA] Brevo respondió", respuesta.status, await respuesta.text().catch(() => ""));
        return false;
    }
    return true;
}

const parrafo = (texto) => `<p style="margin:0 0 16px 0; font-size:15px; line-height:1.7; color:${TEXTO_PRINCIPAL};">${texto}</p>`;
const nota = (texto) => `<p style="margin:16px 0 0 0; font-size:13px; line-height:1.6; color:${TEXTO_SECUNDARIO};">${texto}</p>`;

/** Documento firmado electrónicamente (cotización, presupuesto, orden, ficha, consentimiento). */
export function htmlDocumentoFirmado({ empresa, nombrePaciente, tipoLegible, profesional, codigo, urlVerificacion }) {
    return construirCorreoBase({
        eyebrow: empresa?.empresaNombre,
        titulo: `Tienes un documento de ${empresa?.empresaNombre || "tu centro de salud"}`,
        introHtml: `<p style="margin:0;">Hola${nombrePaciente ? ` <strong>${escapar(nombrePaciente)}</strong>` : ""}:</p>`,
        contenidoHtml: `
            ${parrafo("Adjuntamos tu documento en PDF, firmado electrónicamente por el profesional (firma electrónica simple, Ley 19.799).")}
            ${construirTablaDetalle([
                { label: "Documento", value: tipoLegible },
                { label: "Profesional", value: profesional },
                { label: "Código de verificación", value: codigo },
            ])}
            <div style="margin-top:20px;">${construirBoton({ href: urlVerificacion, texto: "Verificar documento" })}</div>
            ${nota("Con el código o el QR del documento puedes comprobar en cualquier momento que es auténtico y que no fue modificado.")}`,
        nombreEmpresa: empresa?.empresaNombre,
    });
}

/** Constancia de la política de privacidad aceptada al reservar. */
export function htmlConstancias({ empresa, nombrePaciente }) {
    return construirCorreoBase({
        eyebrow: empresa?.empresaNombre,
        titulo: "Constancia de tu aceptación",
        introHtml: `<p style="margin:0;">Hola${nombrePaciente ? ` <strong>${escapar(nombrePaciente)}</strong>` : ""}:</p>`,
        contenidoHtml: `
            ${parrafo("Al reservar tu hora aceptaste la política de privacidad del centro. Adjuntamos la constancia, con el texto exacto que aceptaste.")}
            ${nota(`Puedes revocar tu consentimiento cuando quieras escribiendo a ${escapar(empresa?.contactoEmail || "el centro")}.`)}`,
        nombreEmpresa: empresa?.empresaNombre,
    });
}

/** Código OTP para aceptar un consentimiento informado. Sin nombre del procedimiento. */
export function htmlCodigoOtp({ empresa, codigo }) {
    return construirCorreoBase({
        eyebrow: empresa?.empresaNombre,
        titulo: "Tu código de verificación",
        contenidoHtml: `
            ${parrafo("Usa este código para aceptar tu consentimiento informado en la consulta:")}
            <p style="margin:8px 0 16px 0; font-size:32px; font-weight:700; letter-spacing:8px; color:${TEXTO_PRINCIPAL};">${codigo}</p>
            ${nota("Vence en 10 minutos. Si no estás en la consulta, ignora este correo y no compartas el código.")}`,
        nombreEmpresa: empresa?.empresaNombre,
    });
}
