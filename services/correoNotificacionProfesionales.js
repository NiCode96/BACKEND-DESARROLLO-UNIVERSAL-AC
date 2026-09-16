import { construirCorreoBase, construirTablaDetalle } from "./emailTemplateBase.js";

export default async function enviarCorreoProfesionales(
    correoProfesional,
    nombreProfesional,
    nombreDelPaciente,
    fechaAtencion,
    horaAtencion

) {

    const nombreEmpresa = process.env.NOMBRE_EMPRESA || "Agenda Clínica";
    const profesional = String(nombreProfesional || "").trim();
    const paciente = String(nombreDelPaciente || "").trim();

    const filas = [
        { label: "Paciente", value: paciente || "—" },
    ];

    // El nombre del profesional solo se muestra si viene: antes se imprimia
    // "Hola, ." cuando el dato llegaba vacio.
    if (profesional) {
        filas.push({ label: "Profesional", value: profesional });
    }

    filas.push(
        { label: "Fecha", value: fechaAtencion || "—" },
        { label: "Hora", value: horaAtencion || "—" }
    );

    const message = construirCorreoBase({
        eyebrow: "Notificación Interna",
        titulo: "Nueva reserva asignada",
        introHtml: '<p style="margin:0;">Se registró una nueva reserva en tu agenda profesional.</p>',
        contenidoHtml: construirTablaDetalle(filas),
        footerNota: `Correo automático del sistema de agendamiento de ${nombreEmpresa}.`,
        nombreEmpresa,
    });

    const { BREVO_API_KEY, CORREO_REMITENTE } = process.env;

    if (!BREVO_API_KEY) {
        console.error("BREVO_API_KEY no configurada");
        return;
    }

    if (!CORREO_REMITENTE) {
        console.error("CORREO_REMITENTE no configurado");
        return;
    }

    const payload = {
        sender: {
            name: "Agenda Clínica",
            email: CORREO_REMITENTE
        },
        to: [
            {
                email: correoProfesional
            }
        ],

        subject: paciente ? `Nueva reserva asignada - ${paciente}` : "Nueva reserva asignada",
        htmlContent: message,

        textContent: `Nueva reserva asignada. Paciente: ${paciente || "-"}. Fecha: ${fechaAtencion || "-"} ${horaAtencion || "-"}.`
    };

    const respuesta = await fetch(
        "https://api.brevo.com/v3/smtp/email",
        {
            method: "POST",
            headers: {
                accept: "application/json",
                "content-type": "application/json",
                "api-key": BREVO_API_KEY
            },

            body: JSON.stringify(payload)
        }
    );

    if (!respuesta.ok) {
        const error = await respuesta.text();
        console.error("Error enviando correo:", error);
        return;
    }

    console.log("########################### CORREO DE PRUEBAS ENVIADO A ======= ", correoProfesional);
}