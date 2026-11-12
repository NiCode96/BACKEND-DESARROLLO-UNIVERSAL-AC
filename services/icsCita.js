/*
    icsCita.js
    Evento de calendario de una cita, en sus dos versiones:

    - "paciente": lo que ve el paciente en SU calendario (que suele sincronizarse con
      Google o iCloud y mostrarse en la pantalla bloqueada). Sin su nombre ni el motivo
      de la consulta (dato de salud, Ley 21.719): solo con quién, dónde y cuándo.
    - "equipo": para el profesional y el equipo de la clínica. Nombre del paciente con
      la inicial del apellido, sin RUT ni motivo, y el enlace a la reserva en la
      plataforma (el detalle se ve ahí, con sesión).

    El UID lleva el dominio de la instancia: dos clínicas con el mismo número de reserva
    ya no se pisan en el calendario de un paciente que se atiende en ambas.
    Nunca lanza: si algo falla, el correo se envía igual sin adjunto.
*/
import { generarICSBase64 } from "./icsUtils.js";

const pad2 = (n) => String(n).padStart(2, "0");

function urlInstancia() {
    const base = String(process.env.URL_PUBLICA_SITIO || process.env.FRONT_URL || "").trim().replace(/\/$/, "");
    return /^https?:\/\//.test(base) ? base : "";
}

function dominioInstancia() {
    try {
        const base = urlInstancia();
        return base ? new URL(base).hostname : "agendaclinica.cl";
    } catch {
        return "agendaclinica.cl";
    }
}

export function uidCita(id_reserva, para = "paciente") {
    return `cita-${id_reserva}${para === "equipo" ? "-equipo" : ""}@${dominioInstancia()}`;
}

// Fecha civil (Date o "AAAA-MM-DD…") y hora "HH:MM[:SS]" → "AAAA-MM-DDTHH:MM:SS" (hora de la clínica).
function combinarFechaHora(fecha, hora) {
    if (!fecha) return null;
    const fechaBase = fecha instanceof Date
        ? `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}-${pad2(fecha.getDate())}`
        : String(fecha).slice(0, 10);
    const m = String(hora ?? "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    const horaBase = m ? `${pad2(m[1])}:${m[2]}:${m[3] || "00"}` : "00:00:00";
    return `${fechaBase}T${horaBase}`;
}

function nombreConInicial(nombre, apellido) {
    const n = String(nombre ?? "").trim();
    const a = String(apellido ?? "").trim();
    return [n, a ? `${a[0].toUpperCase()}.` : ""].filter(Boolean).join(" ") || "Paciente";
}

/**
 * Adjunto .ics para Brevo ({ content: base64, name }) o null.
 * @param {"paciente"|"equipo"} opts.para
 */
export function adjuntoIcsCita({
    para = "paciente",
    id_reserva,
    nombreProfesional,
    nombrePaciente,
    apellidoPaciente,
    nombreClinica,
    direccion,
    fechaInicio,
    horaInicio,
    fechaFinalizacion,
    horaFinalizacion,
    ahora = new Date(),
}) {
    try {
        if (!id_reserva) return null;
        const inicio = combinarFechaHora(fechaInicio, horaInicio);
        if (!inicio) return null;
        const fin = combinarFechaHora(fechaFinalizacion || fechaInicio, horaFinalizacion || horaInicio);
        const clinica = String(nombreClinica || "").trim() || "Agenda Clínica";
        const profesional = String(nombreProfesional || "").trim();

        let titulo, descripcion, recordatorios;
        if (para === "equipo") {
            titulo = `Atención: ${nombreConInicial(nombrePaciente, apellidoPaciente)}`;
            const enlace = urlInstancia() ? `\nVer la reserva: ${urlInstancia()}/dashboard/calendario?id_reserva=${encodeURIComponent(id_reserva)}` : "";
            descripcion = `Reserva N° ${id_reserva} en ${clinica}${profesional ? ` con ${profesional}` : ""}.${enlace}`;
            recordatorios = ["PT30M"];
        } else {
            titulo = profesional ? `Cita con ${profesional}` : `Cita en ${clinica}`;
            descripcion = `Tu hora en ${clinica}. Para confirmar, cambiar o cancelar, usa los enlaces del correo que te enviamos.`;
            recordatorios = ["P1D", "PT1H"];
        }

        const content = generarICSBase64({
            uid: uidCita(id_reserva, para),
            titulo,
            descripcion,
            ubicacion: String(direccion || "").trim() || undefined,
            fechaInicio: inicio,
            fechaFin: fin,
            recordatorios,
            nombreCalendario: clinica,
            ahora,
        });
        return { content, name: "cita.ics" };
    } catch (error) {
        console.error("[ICS] No se pudo generar el adjunto .ics:", error.message);
        return null;
    }
}
