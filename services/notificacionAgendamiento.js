import { construirEnlacesReservaToken } from "./notificacionReservaToken.js";
import { obtenerDatosEmpresaConfig } from "./datosEmpresaConfig.js";
import ReservaPacientes from "../model/ReservaPacientes.js";
import Profesionales from "../model/Profesionales.js";
import { generarICSBase64 } from "./icsUtils.js";
import { construirCorreoBase, construirTablaDetalle, construirBoton, TEXTO_PRINCIPAL, TEXTO_SECUNDARIO, formatearRutCorreo } from "./emailTemplateBase.js";

function formatearMontoCorreo(monto) {
    const numero = Number(monto ?? 0);
    if (!Number.isFinite(numero)) return String(monto ?? "-");
    return numero.toLocaleString("es-CL");
}

function normalizarTextoCorreo(valor, fallback = "-") {
    const texto = String(valor ?? "").trim();
    return texto || fallback;
}

function formatearFechaCorreo(fecha) {
    const valor = String(fecha ?? "").trim();
    if (!valor) return "-";

    const matchIso = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchIso) {
        return `${matchIso[3]}/${matchIso[2]}/${matchIso[1]}`;
    }

    const fechaDate = fecha instanceof Date ? fecha : new Date(valor);
    if (Number.isNaN(fechaDate.getTime())) return valor;

    const partes = new Intl.DateTimeFormat("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "America/Santiago"
    }).formatToParts(fechaDate);
    const obtenerParte = (tipo) => partes.find((parte) => parte.type === tipo)?.value;
    const dia = obtenerParte("day");
    const mes = obtenerParte("month");
    const year = obtenerParte("year");

    return dia && mes && year ? `${dia}/${mes}/${year}` : valor;
}

function formatearHoraCorreo(hora) {
    const valor = String(hora ?? "").trim();
    if (!valor) return "-";

    const matchHora = valor.match(/^(\d{1,2}):(\d{2})/);
    if (!matchHora) return valor;
    return `${matchHora[1].padStart(2, "0")}:${matchHora[2]}`;
}

function campoCorreoAusente(valor) {
    return valor === undefined
        || valor === null
        || (typeof valor === "string" && !valor.trim());
}

async function completarDatosCorreoEquipo(datosCorreo) {
    const camposReserva = [
        "nombreProfesional",
        "nombrePaciente",
        "apellidoPaciente",
        "fechaInicio",
        "horaInicio",
        "fechaFinalizacion",
        "horaFinalizacion",
        "motivo_reserva",
        "monto_reserva",
        "id_profesional"
    ];
    const requiereCompletar = camposReserva.some((campo) => campoCorreoAusente(datosCorreo[campo]));

    if (!requiereCompletar || !datosCorreo.id_reserva) {
        return datosCorreo;
    }

    try {
        const reservaPacienteClass = new ReservaPacientes();
        const dataReserva = await reservaPacienteClass.seleccionarFichasReservadasEspecifica(datosCorreo.id_reserva);
        const reserva = Array.isArray(dataReserva) && dataReserva.length > 0 ? dataReserva[0] : null;
        if (!reserva) return datosCorreo;

        return camposReserva.reduce((datosCompletos, campo) => ({
            ...datosCompletos,
            [campo]: campoCorreoAusente(datosCompletos[campo]) ? reserva[campo] : datosCompletos[campo]
        }), { ...datosCorreo });
    } catch (error) {
        console.error("[MAIL EQUIPO] No se pudieron completar los datos de la reserva:", error.message);
        return datosCorreo;
    }
}

function pad2(n) {
    return String(n).padStart(2, "0");
}

// Acepta fecha como Date o string 'YYYY-MM-DD' y hora como 'HH:MM' o 'HH:MM:SS'.
// Devuelve 'YYYY-MM-DDTHH:MM:SS' (hora local del servidor, sin 'Z') o null si falta la fecha.
function combinarFechaHora(fecha, hora) {
    if (!fecha) return null;
    const fechaBase = fecha instanceof Date
        ? `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}-${pad2(fecha.getDate())}`
        : String(fecha).slice(0, 10);
    const horaBase = hora ? String(hora).slice(0, 8) : "00:00:00";
    return `${fechaBase}T${horaBase}`;
}

// Nunca lanza: si algo falla al armar el .ics, el correo se envía igual sin adjunto.
function construirAdjuntoICS({ id_reserva, titulo, descripcion, ubicacion, fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion, nombreCalendario }) {
    try {
        const inicio = combinarFechaHora(fechaInicio, horaInicio);
        if (!inicio) return null;
        const fin = combinarFechaHora(fechaFinalizacion || fechaInicio, horaFinalizacion || horaInicio);

        const ics = generarICSBase64({
            uid: `cita-${id_reserva}@agendaclinica.cl`,
            titulo,
            descripcion,
            ubicacion,
            fechaInicio: inicio,
            fechaFin: fin,
            todoElDia: false,
            nombreCalendario,
        });

        return { content: ics, name: "cita.ics" };
    } catch (error) {
        console.error("[ICS] No se pudo generar el adjunto .ics:", error.message);
        return null;
    }
}

function construirHtmlCorreoPaciente({
    eyebrow = "Agenda Clinica",
    titulo,
    subtitulo,
    saludo,
    nombrePaciente,
    nombreProfesional,
    rut,
    telefono,
    fechaInicio,
    horaInicio,
    fechaFinalizacion,
    horaFinalizacion,
    motivo_reserva,
    monto_reserva,
    estadoReserva,
    ctaTitulo,
    ctaTexto,
    urlConfirmar,
    urlCancelar,
    fromName
}) {
    const tabla = construirTablaDetalle([
        { label: "Paciente", value: normalizarTextoCorreo(nombrePaciente) },
        { label: "Profesional", value: normalizarTextoCorreo(nombreProfesional) },
        { label: "RUT", value: formatearRutCorreo(rut) },
        { label: "Teléfono", value: normalizarTextoCorreo(telefono) },
        { label: "Inicio", value: `${normalizarTextoCorreo(fechaInicio)} ${normalizarTextoCorreo(horaInicio)}` },
        { label: "Término", value: `${normalizarTextoCorreo(fechaFinalizacion)} ${normalizarTextoCorreo(horaFinalizacion)}` },
        { label: "Motivo", value: normalizarTextoCorreo(motivo_reserva) },
        { label: "Monto", value: `$${formatearMontoCorreo(monto_reserva)}` },
        { label: "Estado", value: normalizarTextoCorreo(estadoReserva) }
    ]);

    const contenidoHtml = `
      <p style="margin: 0 0 6px 0; font-size: 15px; color: ${TEXTO_SECUNDARIO};">${saludo}</p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.7; color: ${TEXTO_PRINCIPAL};">${nombrePaciente}, ${ctaTexto}</p>
      ${tabla}
      <div style="margin-top: 24px;">
        <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: ${TEXTO_PRINCIPAL};">${ctaTitulo}</p>
        ${construirBoton({ href: urlConfirmar, texto: "Confirmar asistencia" })}
        ${construirBoton({ href: urlCancelar, texto: "Cancelar cita", color: TEXTO_SECUNDARIO })}
      </div>
    `;

    return construirCorreoBase({
        eyebrow,
        titulo,
        introHtml: subtitulo ? `<p style="margin:0;">${subtitulo}</p>` : '',
        contenidoHtml,
        footerNota: "Si necesitas ayuda, responde este correo o comunícate con el centro para ajustar tu agenda.",
        nombreEmpresa: fromName
    });
}

function construirHtmlCorreoEquipo({
    titulo,
    subtitulo,
    nombreProfesional,
    nombrePaciente,
    apellidoPaciente,
    fechaInicio,
    horaInicio,
    motivo_reserva,
    monto_reserva,
    id_reserva,
    detalleAccion,
    fromName
}) {
    const tabla = construirTablaDetalle([
        { label: "Paciente", value: `${nombrePaciente} ${apellidoPaciente}` },
        { label: "Profesional", value: normalizarTextoCorreo(nombreProfesional) },
        { label: "ID Reserva", value: id_reserva },
        { label: "Fecha", value: formatearFechaCorreo(fechaInicio) },
        { label: "Hora", value: formatearHoraCorreo(horaInicio) },
        { label: "Motivo", value: normalizarTextoCorreo(motivo_reserva) },
        { label: "Monto", value: `$${formatearMontoCorreo(monto_reserva)}` }
    ]);

    const contenidoHtml = `
      ${tabla}
      <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 1.6; color: ${TEXTO_PRINCIPAL};">${detalleAccion}</p>
    `;

    return construirCorreoBase({
        eyebrow: "Notificación Interna",
        titulo,
        introHtml: subtitulo ? `<p style="margin:0;">${subtitulo}</p>` : '',
        contenidoHtml,
        footerNota: `Correo automático del sistema de agendamiento de ${fromName}.`,
        nombreEmpresa: fromName
    });
}

// Servicio de notificaciones por correo relacionadas con reservas.
// Estructura del archivo:
// 1. Correo al paciente/usuario cuando la reserva fue actualizada.
// 2. Correo al paciente/usuario cuando la reserva fue creada.
// 3. Correo interno al equipo (y, si tiene correo_profesional cargado, también al profesional)
//    cuando ocurre una accion sobre la reserva.



export default class NotificacionAgendamiento {
    // =========================================================
    // BLOQUE 1: CORREO AL PACIENTE/USUARIO POR ACTUALIZACION
    // =========================================================
    // Este correo se envia al paciente que ya tenia una reserva
    // y cuya fecha, hora o datos fueron modificados.
    static async enviarCorreoActualizacionReserva({
                                                      to,
                                                      nombreProfesional,
                                                      nombrePaciente,
                                                      apellidoPaciente,
                                                      rut,
                                                      telefono,
                                                      fechaInicio,
                                                      horaInicio,
                                                      fechaFinalizacion,
                                                      horaFinalizacion,
                                                      monto_reserva,
                                                      motivo_reserva,
                                                      estadoReserva,
                                                      id_reserva
                                                  }) {
        const { BREVO_API_KEY, CORREO_REMITENTE } = process.env;
        const { correoEmpresa, nombreEmpresa, direccionEmpresa } = await obtenerDatosEmpresaConfig();

        if (!BREVO_API_KEY) {
            console.warn("[MAIL] BREVO_API_KEY no configurada. Correo no enviado.");
            return;
        }

        if (!to) {
            console.warn("[MAIL] Destinatario vacío. Correo no enviado.");
            return;
        }

        const emailOk = typeof to === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to);
        if (!emailOk) {
            console.warn("[MAIL] Email inválido:", to, "Correo no enviado.");
            return;
        }

        const fromEmail = CORREO_REMITENTE;
        const fromName = nombreEmpresa || "Sistema de Agendamiento";

        if (!fromEmail) {
            console.warn("[MAIL] CORREO_REMITENTE no configurado. Correo no enviado.");
            return;
        }

        const subject = `Tu cita en ${fromName} ha sido actualizada`;

        const { urlConfirmar, urlCancelar } = construirEnlacesReservaToken({
            id_reserva,
            nombrePaciente,
            apellidoPaciente,
            fechaInicio,
            horaInicio
        });
        const empresa = nombreEmpresa || "Sistema de Agendamiento";

        const text =
            `Tu cita en ${empresa} ha sido actualizada.\n\n` +
            `Detalle actualizado:\n` +
            `• Nombre: ${nombrePaciente} ${apellidoPaciente}\n` +
            `• Profesional: ${nombreProfesional}\n` +
            `• RUT: ${rut}\n` +
            `• Teléfono: ${telefono}\n` +
            `• Inicio: ${fechaInicio} ${horaInicio}\n` +
            `• Término: ${fechaFinalizacion} ${horaFinalizacion}\n` +
            `• Motivo: ${motivo_reserva}\n` +
            `• Monto: $${monto_reserva}\n` +
            `• Estado: ${estadoReserva}\n\n` +
            `Te pedimos confirmar tu asistencia con la nueva fecha/hora usando los enlaces de este correo.\n` +
            `Si no puedes asistir, por favor cancela con anticipación.\n\n` +
            `Saludos, ${empresa}.`;

        const html = construirHtmlCorreoPaciente({
            eyebrow: "Actualización de Reserva",
            titulo: `Tu cita en ${fromName} fue actualizada`,
            subtitulo: "Hemos registrado cambios en tu agenda. Revisa el nuevo detalle clínico y confirma tu asistencia desde este mismo correo.",
            saludo: "Hola,",
            nombrePaciente: `${nombrePaciente} ${apellidoPaciente}`,
            nombreProfesional,
            rut,
            telefono,
            fechaInicio,
            horaInicio,
            fechaFinalizacion,
            horaFinalizacion,
            motivo_reserva,
            monto_reserva,
            estadoReserva,
            ctaTitulo: "Confirma el horario actualizado",
            ctaTexto: "tu reserva fue modificada y ya se encuentra actualizada en nuestro sistema.",
            urlConfirmar,
            urlCancelar,
            fromName
        });

        const adjuntoICS = construirAdjuntoICS({
            id_reserva,
            titulo: `Cita con ${nombreProfesional || fromName}`,
            descripcion: `Paciente: ${nombrePaciente} ${apellidoPaciente}. Motivo: ${motivo_reserva || "-"}.`,
            ubicacion: direccionEmpresa,
            fechaInicio,
            horaInicio,
            fechaFinalizacion,
            horaFinalizacion,
            nombreCalendario: fromName
        });

        const payload = {
            sender: { name: fromName, email: fromEmail },
            to: [{ email: to }],
            replyTo: correoEmpresa ? { email: correoEmpresa, name: fromName } : undefined,
            subject,
            textContent: text,
            htmlContent: html,
            ...(adjuntoICS ? { attachment: [adjuntoICS] } : {})
        };

        if (typeof fetch !== "function") {
            console.warn("[MAIL] Tu Node no tiene fetch (requiere Node 18+). Correo no enviado.");
            return;
        }

        console.log("[MAIL] Enviando actualización a:", to, "| id_reserva:", id_reserva, "| from:", fromEmail);

        const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                accept: "application/json",
                "content-type": "application/json",
                "api-key": BREVO_API_KEY
            },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const errText = await resp.text().catch(() => "");
            console.error("[MAIL] Brevo error:", resp.status, errText);
            return;
        }

        console.log("[MAIL] Actualización enviada OK a:", to, "| id_reserva:", id_reserva);
    }

    // =========================================================
    // BLOQUE 2: CORREO AL PACIENTE/USUARIO POR NUEVA RESERVA
    // =========================================================
    // Este correo se envia al paciente/usuario cuando la reserva
    // fue ingresada correctamente en el sistema.
    static async enviarCorreoConfirmacionReserva({
                                                     to,
                                                     nombreProfesional,
                                                     nombrePaciente,
                                                     apellidoPaciente,
                                                     rut,
                                                     telefono,
                                                     fechaInicio,
                                                     horaInicio,
                                                     fechaFinalizacion,
                                                     horaFinalizacion,
                                                     monto_reserva,
                                                     motivo_reserva,
                                                     estadoReserva,
                                                     id_reserva
                                                 }) {
        const { BREVO_API_KEY, API_URL, CORREO_REMITENTE } = process.env;
        const { correoEmpresa, nombreEmpresa, direccionEmpresa } = await obtenerDatosEmpresaConfig();

        // No romper el flujo principal si falta configuración
        if (!BREVO_API_KEY) {
            console.warn("[MAIL] BREVO_API_KEY no configurada. Correo no enviado.");
            return;
        }

        if (!to) {
            console.warn("[MAIL] Destinatario vacío. Correo no enviado.");
            return;
        }

        const emailOk = typeof to === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to);
        if (!emailOk) {
            console.warn("[MAIL] Email inválido:", to, "Correo no enviado.");
            return;
        }

        // En Brevo, el 'from' debe ser un remitente verificado.
        const fromEmail = CORREO_REMITENTE;
        const fromName = nombreEmpresa || "Sistema de Agendamiento";

        if (!fromEmail) {
            console.warn("[MAIL] CORREO_REMITENTE no configurado. Correo no enviado.");
            return;
        }

        const subject = `Tu cita en ${fromName} ha sido registrada`;

        // Construir URLs
        const { urlConfirmar, urlCancelar } = construirEnlacesReservaToken({
            id_reserva,
            nombrePaciente,
            apellidoPaciente,
            fechaInicio,
            horaInicio
        });
        const empresa = nombreEmpresa || "Sistema de Agendamiento";

        const text =
            `Tu cita en ${empresa} ha sido registrada.\n\n` +
            `Detalle de tu reserva:\n` +
            `• Nombre: ${nombrePaciente} ${apellidoPaciente}\n` +
            `• Profesional: ${nombreProfesional}\n` +
            `• RUT: ${rut}\n` +
            `• Teléfono: ${telefono}\n` +
            `• Inicio: ${fechaInicio} ${horaInicio}\n` +
            `• Término: ${fechaFinalizacion} ${horaFinalizacion}\n` +
            `• Motivo: ${motivo_reserva}\n` +
            `• Monto: $${monto_reserva}\n` +
            `• Estado: ${estadoReserva}\n\n` +
            `Te recordamos confirmar tu cita a través de los enlaces de este correo.\n` +
            `En caso de no poder asistir, te pedimos cancelarla con anticipación para poder reasignar ese horario a otro paciente.\n` +
            `Muchas gracias por tu colaboracion.\n\n` +
            `Saludos, ${empresa}.`;

        const html = construirHtmlCorreoPaciente({
            eyebrow: "Reserva Confirmada",
            titulo: `Tu cita en ${fromName} fue registrada`,
            subtitulo: "Tu agendamiento fue ingresado correctamente. A continuación puedes revisar el detalle clínico de la atención y gestionar tu asistencia.",
            saludo: "Hola,",
            nombrePaciente: `${nombrePaciente} ${apellidoPaciente}`,
            nombreProfesional,
            rut,
            telefono,
            fechaInicio,
            horaInicio,
            fechaFinalizacion,
            horaFinalizacion,
            motivo_reserva,
            monto_reserva,
            estadoReserva,
            ctaTitulo: "Gestiona tu asistencia",
            ctaTexto: "tu reserva fue registrada exitosamente en nuestra agenda.",
            urlConfirmar,
            urlCancelar,
            fromName
        });

        const adjuntoICS = construirAdjuntoICS({
            id_reserva,
            titulo: `Cita con ${nombreProfesional || fromName}`,
            descripcion: `Paciente: ${nombrePaciente} ${apellidoPaciente}. Motivo: ${motivo_reserva || "-"}.`,
            ubicacion: direccionEmpresa,
            fechaInicio,
            horaInicio,
            fechaFinalizacion,
            horaFinalizacion,
            nombreCalendario: fromName
        });

        const payload = {
            sender: { name: fromName, email: fromEmail },
            to: [{ email: to }],
            replyTo: correoEmpresa ? { email: correoEmpresa, name: fromName } : undefined,
            subject,
            textContent: text,
            htmlContent: html,
            ...(adjuntoICS ? { attachment: [adjuntoICS] } : {})
        };

        // Node 18+ trae fetch. Si tu runtime es más antiguo, actualiza Node.
        if (typeof fetch !== "function") {
            console.warn("[MAIL] Tu Node no tiene fetch (requiere Node 18+). Correo no enviado.");
            return;
        }

        console.log("[MAIL] Enviando a:", to, "| id_reserva:", id_reserva, "| from:", fromEmail);

        const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                accept: "application/json",
                "content-type": "application/json",
                "api-key": BREVO_API_KEY
            },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const errText = await resp.text().catch(() => "");
            console.error("[MAIL] Brevo error:", resp.status, errText);
            return;
        }

        console.log("[MAIL] Enviado OK a:", to, "| id_reserva:", id_reserva);
    }

    // =========================================================
    // BLOQUE 3: CORREO INTERNO AL EQUIPO / NEGOCIO
    // =========================================================
    // Este correo NO va al paciente.
    // Va al contactoEmail configurado en datos_empresa para
    // avisar al equipo que una cita fue agendada, actualizada,
    // confirmada o cancelada.
    static async enviarCorreoConfirmacionEquipo(datosCorreo) {
        const {
            nombreProfesional,
            nombrePaciente,
            apellidoPaciente,
            fechaInicio,
            horaInicio,
            fechaFinalizacion,
            horaFinalizacion,
            monto_reserva,
            motivo_reserva,
            accion, // "CONFIRMADA", "CANCELADA" o "AGENDADA"
            origen, // solo aplica a "AGENDADA": "dashboard" | "web" | "mercadopago"
            id_reserva,
            id_profesional
        } = await completarDatosCorreoEquipo(datosCorreo);
        const { BREVO_API_KEY, CORREO_REMITENTE } = process.env;
        const { correoEmpresa, nombreEmpresa, direccionEmpresa } = await obtenerDatosEmpresaConfig();

        if (!BREVO_API_KEY) {
            console.warn("[MAIL EQUIPO] BREVO_API_KEY no configurada. Correo no enviado.");
            return;
        }

        const fromEmail = CORREO_REMITENTE;
        const fromName = nombreEmpresa || "Sistema de Agendamiento";

        if (!fromEmail) {
            console.warn("[MAIL EQUIPO] CORREO_REMITENTE no configurado. Correo no enviado.");
            return;
        }

        // Destinatarios: el correo interno de siempre (correoEmpresa) + el correo propio
        // del profesional si ya lo tiene cargado (columna correo_profesional, aún opcional
        // mientras no exista login real de profesional). Nunca duplica si coinciden.
        const destinatarios = [];
        const vistos = new Set();
        const agregarDestinatario = (correo) => {
            const limpio = String(correo || "").trim();
            if (!limpio || vistos.has(limpio.toLowerCase())) return;
            vistos.add(limpio.toLowerCase());
            destinatarios.push(limpio);
        };

        agregarDestinatario(correoEmpresa);

        if (id_profesional) {
            try {
                const profesionalClass = new Profesionales();
                const filas = await profesionalClass.seleccionarProfesionalPorID(id_profesional);
                agregarDestinatario(Array.isArray(filas) && filas[0]?.correo_profesional);
            } catch (error) {
                console.error("[MAIL EQUIPO] No se pudo obtener correo_profesional:", error.message);
            }
        }

        if (destinatarios.length === 0) {
            console.warn("[MAIL EQUIPO] Sin contactoEmail ni correo_profesional configurados. Correo no enviado.");
            return;
        }
        let subject, text, colorAccion, iconoAccion, textoAccion, detalleAccion;
        const fechaCorreo = formatearFechaCorreo(fechaInicio);
        const horaCorreo = formatearHoraCorreo(horaInicio);
        const profesionalCorreo = normalizarTextoCorreo(nombreProfesional);
        const motivoCorreo = normalizarTextoCorreo(motivo_reserva);
        const montoCorreo = formatearMontoCorreo(monto_reserva);

        switch (accion) {
            case "CONFIRMADA":
                subject = `Cita CONFIRMADA por ${nombrePaciente} ${apellidoPaciente}`;
                textoAccion = "CONFIRMADA";
                iconoAccion = "✅";
                colorAccion = "#10b981";
                detalleAccion = "El paciente confirmó su cita desde el enlace del correo.";
                text = `El paciente ${nombrePaciente} ${apellidoPaciente} ha CONFIRMADO su cita.\n\n` +
                    `• ID Reserva: ${id_reserva}\n` +
                    `• Fecha: ${fechaCorreo}\n` +
                    `• Hora: ${horaCorreo}\n` +
                    `• Profesional: ${profesionalCorreo}\n` +
                    `• Motivo: ${motivoCorreo}\n` +
                    `• Monto: $${montoCorreo}\n\n` +
                    `${detalleAccion}`;
                break;

            case "AGENDADA":
                subject = `Nueva Reserva (Agenda Clinica) - ${nombrePaciente} ${apellidoPaciente}`;
                textoAccion = "NUEVA RESERVA";
                iconoAccion = "🗓️";
                colorAccion = "#3b82f6"; // Azul para nueva reserva
                if (origen === "web") {
                    detalleAccion = "La reserva fue creada desde el calendario agenda web.";
                } else if (origen === "mercadopago") {
                    detalleAccion = "La reserva se creó automáticamente al confirmarse el pago en línea (MercadoPago).";
                } else {
                    detalleAccion = "La reserva fue creada desde el calendario interno.";
                }
                text = `Se ha creado una nueva reserva desde la agenda clínica para ${nombrePaciente} ${apellidoPaciente}.\n\n` +
                    `• ID Reserva: ${id_reserva}\n` +
                    `• Fecha: ${fechaCorreo}\n` +
                    `• Hora: ${horaCorreo}\n` +
                    `• Profesional: ${profesionalCorreo}\n` +
                    `• Motivo: ${motivoCorreo}\n` +
                    `• Monto: $${montoCorreo}\n\n` +
                    `${detalleAccion}`;
                break;

            case "ACTUALIZADA":
                subject = `Cita ACTUALIZADA - ${nombrePaciente} ${apellidoPaciente}`;
                textoAccion = "ACTUALIZADA";
                iconoAccion = "🔄";
                colorAccion = "#2563eb";
                detalleAccion = "La reserva fue actualizada desde la agenda clínica.";
                text = `Se actualizó una reserva para ${nombrePaciente} ${apellidoPaciente}.\n\n` +
                    `• ID Reserva: ${id_reserva}\n` +
                    `• Fecha: ${fechaCorreo}\n` +
                    `• Hora: ${horaCorreo}\n` +
                    `• Profesional: ${profesionalCorreo}\n` +
                    `• Motivo: ${motivoCorreo}\n` +
                    `• Monto: $${montoCorreo}\n\n` +
                    `${detalleAccion}`;
                break;

            case "CANCELADA":
            default:
                subject = `Cita CANCELADA por ${nombrePaciente} ${apellidoPaciente}`;
                textoAccion = "CANCELADA";
                iconoAccion = "❌";
                colorAccion = "#ef4444";
                detalleAccion = "El paciente canceló su cita desde el enlace del correo.";
                text = `El paciente ${nombrePaciente} ${apellidoPaciente} ha CANCELADO su cita.\n\n` +
                    `• ID Reserva: ${id_reserva}\n` +
                    `• Fecha: ${fechaCorreo}\n` +
                    `• Hora: ${horaCorreo}\n` +
                    `• Profesional: ${profesionalCorreo}\n` +
                    `• Motivo: ${motivoCorreo}\n` +
                    `• Monto: $${montoCorreo}\n\n` +
                    `${detalleAccion}`;
                break;
        }

        const html = construirHtmlCorreoEquipo({
            titulo: `Cita ${textoAccion}`,
            subtitulo: detalleAccion,
            nombreProfesional,
            nombrePaciente,
            apellidoPaciente,
            fechaInicio,
            horaInicio,
            motivo_reserva,
            monto_reserva,
            id_reserva,
            detalleAccion,
            fromName
        });

        // No se envía .ics para una cancelación (no tiene sentido invitar a un evento que ya no ocurrirá).
        const adjuntoICS = accion === "CANCELADA" ? null : construirAdjuntoICS({
            id_reserva,
            titulo: `Cita con ${profesionalCorreo}`,
            descripcion: `Paciente: ${nombrePaciente} ${apellidoPaciente}. Motivo: ${motivoCorreo}.`,
            ubicacion: direccionEmpresa,
            fechaInicio,
            horaInicio,
            fechaFinalizacion,
            horaFinalizacion,
            nombreCalendario: fromName
        });

        const payload = {
            sender: { name: fromName, email: fromEmail },
            to: destinatarios.map((email) => ({ email })),
            subject,
            ...(adjuntoICS ? { attachment: [adjuntoICS] } : {}),
            textContent: text,
            htmlContent: html
        };

        if (typeof fetch !== "function") {
            console.warn("[MAIL EQUIPO] Tu Node no tiene fetch (requiere Node 18+). Correo no enviado.");
            return;
        }

        const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                accept: "application/json",
                "content-type": "application/json",
                "api-key": BREVO_API_KEY
            },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const errText = await resp.text().catch(() => "");
            console.error("[MAIL EQUIPO] Brevo error:", resp.status, errText);
            return;
        }

        console.log(`[MAIL EQUIPO] Notificación enviada: Cita ${textoAccion}`);
    }
}
