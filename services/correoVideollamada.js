/* Correo con el enlace de la videoconsulta. Mismo estilo y envío (Brevo) que los
 * correos de la firma. Ley 21.719 (minimización): ni motivo ni datos clínicos; solo
 * quién invita, el botón para entrar y hasta cuándo sirve. */

import { construirCorreoBase, construirBoton } from "./emailTemplateBase.js";
import { escapar, parrafo, nota } from "./firma/correoFirma.js";

/** "14-11-2026 19:30" en hora de Chile (expira es un instante, no una fecha civil). */
export function venceEnChile(expiraMs) {
    const partes = Object.fromEntries(new Intl.DateTimeFormat("es-CL", {
        timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(expiraMs)).map((p) => [p.type, p.value]));
    return `${partes.day}-${partes.month}-${partes.year} ${partes.hour}:${partes.minute}`;
}

export function htmlInvitacionVideollamada({ empresa, nombrePaciente, nombreProfesional, enlace, expira }) {
    const quien = nombreProfesional ? escapar(nombreProfesional) : "Tu profesional";
    return construirCorreoBase({
        eyebrow: empresa?.empresaNombre,
        titulo: "Tu videoconsulta",
        introHtml: `<p style="margin:0;">Hola${nombrePaciente ? ` <strong>${escapar(nombrePaciente)}</strong>` : ""}:</p>`,
        contenidoHtml: `
            ${parrafo(`${quien} te invita a tu videoconsulta${empresa?.empresaNombre ? ` en ${escapar(empresa.empresaNombre)}` : ""}.`)}
            <div style="margin-top:8px;">${construirBoton({ href: enlace, texto: "Entrar a la videoconsulta" })}</div>
            ${nota(`Para entrar tienes hasta el ${venceEnChile(expira)} (hora de Chile); si no alcanzas, pídele un enlace nuevo al profesional. Ábrelo desde tu celular o computador y permite el uso de la cámara y el micrófono. Si no esperabas esta videoconsulta, ignora este correo.`)}`,
        nombreEmpresa: empresa?.empresaNombre,
    });
}
