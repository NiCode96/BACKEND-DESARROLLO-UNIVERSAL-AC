/*
    icsUtils.js
    Archivo de calendario (.ics, RFC 5545) que se adjunta a los correos de la cita.

    Reglas:
    - Las horas de la cita son hora de la clínica (America/Santiago). En el archivo van
      como instante UTC ("...Z"), calculado con la zona de la clínica: así la cita queda
      a la hora correcta en cualquier calendario y en cualquier país (antes iban sin zona
      y el teléfono las leía en SU hora: un celular con hora de Argentina la corría).
    - DTSTAMP también en UTC, sin depender del huso del servidor.
    - METHOD:PUBLISH + SEQUENCE creciente: un cambio de hora con el mismo UID actualiza
      el evento en el calendario en vez de duplicarlo o ignorarlo.
    - Recordatorios (VALARM): Apple Calendar y Outlook los respetan; Google Calendar usa
      sus propias notificaciones por defecto.
    - Líneas plegadas a 75 octetos (no caracteres: las tildes ocupan 2).
*/

function pad(n) {
    return String(n).padStart(2, '0');
}

// Evita interpretar 'YYYY-MM-DD' como UTC (que en zonas horarias negativas corre
// la fecha un día hacia atrás al leerla con getters locales). Trabaja siempre
// con componentes de calendario, nunca cruzando por epoch/UTC.
function toDateParts(fecha) {
    if (typeof fecha === 'string') {
        const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
        }
    }
    const d = new Date(fecha);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function addDays({ year, month, day }, n) {
    const d = new Date(year, month - 1, day + n);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function formatDateParts({ year, month, day }) {
    return `${year}${pad(month)}${pad(day)}`;
}

/** Instante → "AAAAMMDDTHHMMSSZ". */
function formatearUtc(instante) {
    const d = new Date(instante);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

// Milisegundos que la zona está adelantada respecto de UTC en ese instante (Chile: negativo).
function desfaseZonaMs(instanteMs, zona) {
    const partes = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone: zona, hourCycle: 'h23',
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
        }).formatToParts(new Date(instanteMs)).map((p) => [p.type, p.value])
    );
    const comoUtc = Date.UTC(+partes.year, +partes.month - 1, +partes.day, +partes.hour, +partes.minute, +partes.second);
    return comoUtc - Math.floor(instanteMs / 1000) * 1000;
}

/**
 * "AAAA-MM-DDTHH:MM[:SS]" en hora de `zona` → instante (Date).
 * Dos pasadas para acertar el desfase justo en los cambios de horario.
 */
export function instanteDesdeHoraLocal(texto, zona = 'America/Santiago') {
    const m = String(texto ?? '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) throw new Error(`Fecha y hora inválidas: ${texto}`);
    const comoUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    let instante = comoUtc - desfaseZonaMs(comoUtc, zona);
    instante = comoUtc - desfaseZonaMs(instante, zona);
    return new Date(instante);
}

function escapeICSText(texto = '') {
    return String(texto)
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\;')
        .replace(/,/g, '\\,')
        .replace(/\r\n|\r|\n/g, '\\n');
}

// RFC 5545 §3.1: líneas de máximo 75 OCTETOS; la continuación empieza con un espacio
// (que también cuenta). Nunca se corta un carácter por la mitad.
function foldLine(line) {
    if (Buffer.byteLength(line) <= 75) return line;
    const partes = [];
    let actual = '';
    let octetos = 0;
    let limite = 75;
    for (const caracter of line) {
        const tam = Buffer.byteLength(caracter);
        if (octetos + tam > limite) {
            partes.push(actual);
            actual = ' ';
            octetos = 1;
            limite = 75;
        }
        actual += caracter;
        octetos += tam;
    }
    partes.push(actual);
    return partes.join('\r\n');
}

/**
 * Genera un archivo .ics (iCalendar) como texto plano, listo para adjuntar en un correo.
 *
 * @param {object} opts
 * @param {string} opts.uid            Identificador único y estable del evento (por reserva y por instancia)
 * @param {string} opts.titulo         SUMMARY del evento
 * @param {string} [opts.descripcion]  DESCRIPTION del evento
 * @param {string} [opts.ubicacion]    LOCATION del evento
 * @param {Date|string} opts.fechaInicio      Evento con hora: "AAAA-MM-DDTHH:MM:SS" en hora de `zonaHoraria`
 * @param {Date|string} [opts.fechaFin]       Si no se indica: mismo instante (con hora) o +1 día (todo el día)
 * @param {boolean} [opts.todoElDia=false]    true para eventos sin hora específica
 * @param {string} [opts.zonaHoraria='America/Santiago']
 * @param {number} [opts.secuencia]           SEQUENCE: debe crecer con cada cambio del mismo evento
 * @param {string[]} [opts.recordatorios=[]]  Duraciones ISO antes del inicio: ["P1D", "PT1H"]
 * @param {string} [opts.nombreCalendario='AgendaClinica']
 * @param {Date} [opts.ahora=new Date()]
 * @returns {string} contenido .ics
 */
export function generarICS({
    uid,
    titulo,
    descripcion,
    ubicacion,
    fechaInicio,
    fechaFin,
    todoElDia = false,
    zonaHoraria = 'America/Santiago',
    secuencia,
    recordatorios = [],
    nombreCalendario = 'AgendaClinica',
    ahora = new Date(),
}) {
    let dtStartLine, dtEndLine;
    if (todoElDia) {
        const inicio = toDateParts(fechaInicio);
        const fin = fechaFin ? toDateParts(fechaFin) : addDays(inicio, 1);
        dtStartLine = `DTSTART;VALUE=DATE:${formatDateParts(inicio)}`;
        dtEndLine = `DTEND;VALUE=DATE:${formatDateParts(fin)}`;
    } else {
        const inicio = instanteDesdeHoraLocal(fechaInicio, zonaHoraria);
        const fin = instanteDesdeHoraLocal(fechaFin || fechaInicio, zonaHoraria);
        dtStartLine = `DTSTART:${formatearUtc(inicio)}`;
        dtEndLine = `DTEND:${formatearUtc(fin > inicio ? fin : inicio)}`;
    }
    const seq = Number.isInteger(secuencia) && secuencia >= 0 ? secuencia : Math.floor(ahora.getTime() / 1000);

    const alarmas = recordatorios.flatMap((antes) => [
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeICSText(titulo)}`,
        `TRIGGER:-${antes}`,
        'END:VALARM',
    ]);

    const lineas = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//AgendaClinica//ES',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `NAME:${escapeICSText(nombreCalendario)}`,
        `X-WR-CALNAME:${escapeICSText(nombreCalendario)}`,
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${formatearUtc(ahora)}`,
        dtStartLine,
        dtEndLine,
        `SEQUENCE:${seq}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        `SUMMARY:${escapeICSText(titulo)}`,
        ...(descripcion ? [`DESCRIPTION:${escapeICSText(descripcion)}`] : []),
        ...(ubicacion ? [`LOCATION:${escapeICSText(ubicacion)}`] : []),
        ...alarmas,
        'END:VEVENT',
        'END:VCALENDAR',
    ];

    return lineas.map(foldLine).join('\r\n') + '\r\n';
}

export function generarICSBase64(opts) {
    return Buffer.from(generarICS(opts), 'utf-8').toString('base64');
}
