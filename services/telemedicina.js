import twilio from "twilio";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/* Videoconsulta (Twilio Video).
 *
 * Reglas del enlace del paciente (decididas el 15-11-2026):
 *  - Cada envío (WhatsApp, correo o copiar) genera un enlace nuevo que sirve 15 minutos,
 *    contados con el reloj del servidor. Los anteriores vencen a su hora.
 *  - Cada enlace deja entrar a UN paciente. Ese paciente puede volver a entrar si se le
 *    corta, aunque pasen los 15 minutos, con la llave que recibió al entrar.
 *  - Cuando la sala termina (el profesional aprieta "Salir", se vacía o llega a la
 *    duración máxima), ningún enlace vuelve a funcionar: "La videollamada finalizó".
 *
 * Todo es sin estado propio: la invitación va firmada y el estado real de la sala y de
 * quién entró se le pregunta a Twilio, que no olvida una sala terminada (por su sid). */

export const MINUTOS_INVITACION = 15;
const DURACION_INVITACION_MS = MINUTOS_INVITACION * 60 * 1000;

// Duración máxima de la videollamada. Se aplica dos veces: en la sala
// (maxParticipantDuration, corte a nivel de Twilio) y en el token (ttl,
// válido solo ese tiempo desde que la persona entra).
const DURACION_MAXIMA_LLAMADA_SEG = 45 * 60;

// Minutos que la sala sigue abierta vacía (caída de internet de los dos, pestaña cerrada
// sin "Salir"). Pasado eso Twilio la termina y el enlace dice "finalizó".
const MINUTOS_SALA_VACIA = 5;

export const IDENTIDAD_PROFESIONAL = "profesional";
const PREFIJO_PACIENTE = "paciente-";

function firmar(texto) {
    const secret = process.env.TWILIO_API_SECRET;
    if (!secret) throw new Error("Falta configurar TWILIO_API_SECRET");
    return createHmac("sha256", secret).update(texto).digest("base64url");
}

function firmaCoincide(texto, firma) {
    const esperada = Buffer.from(firmar(texto), "base64url");
    const recibida = Buffer.from(String(firma ?? ""), "base64url");
    return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

/** Huella de quien creó la sala. Va en la invitación (que el paciente puede leer), así que
 *  no lleva el id de Clerk: solo sirve para comprobar que quien cierra o reenvía es él. */
export function huellaCreador(clerkId) {
    return firmar(`creador:${clerkId}`).slice(0, 22);
}

// Cliente Twilio exclusivo para telemedicina.
// Los nombres deben coincidir con el .env: TWILIO_API_KEY (formato SK...) y
// TWILIO_API_SECRET. Con credenciales undefined el cliente se construye igual
// y falla recién al crear la sala, con un error de autenticación críptico.
const clienteTwilioVideo = twilio(
    process.env.TWILIO_API_KEY,
    process.env.TWILIO_API_SECRET,
    {
        accountSid: process.env.TWILIO_ACCOUNT_SID
    }
);

const { AccessToken } = twilio.jwt;

export default class TelemedicinaService {

    /** Invitación firmada: { sala, sid, prof, creador, n (id del enlace), expira }. */
    generarInvitacion({ nombreSala, sid, nombreProfesional, creador }) {
        const payload = Buffer.from(JSON.stringify({
            sala: nombreSala,
            sid,
            // Va dentro del payload firmado: la página del paciente puede
            // leerlo para mostrar el encabezado, pero no alterarlo.
            prof: nombreProfesional || undefined,
            creador,
            n: randomBytes(6).toString("hex"),
            expira: Date.now() + DURACION_INVITACION_MS
        })).toString("base64url");
        return `${payload}.${firmar(payload)}`;
    }

    /** Datos de una invitación de esa sala con firma válida (vencida o no), o null.
     *  `vigente` dice si está dentro de sus 15 minutos. */
    leerInvitacion(nombreSala, invitacion) {
        try {
            if (typeof invitacion !== "string") return null;
            const [payload, firma] = invitacion.split(".");
            if (!payload || !firma || !firmaCoincide(payload, firma)) return null;
            const datos = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
            if (datos.sala !== nombreSala || typeof datos.sid !== "string" || typeof datos.n !== "string") return null;
            return { ...datos, vigente: Number(datos.expira) > Date.now() };
        } catch {
            return null;
        }
    }

    /** Invitación nueva (15 minutos nuevos) para la misma sala y el mismo creador. */
    renovarInvitacion(datos) {
        return this.generarInvitacion({ nombreSala: datos.sala, sid: datos.sid, nombreProfesional: datos.prof, creador: datos.creador });
    }

    /** Identidad de un paciente nuevo: lleva el id del enlace con que entró, así cada enlace
     *  deja entrar a una sola persona. La llave le permite volver si se le corta. */
    nuevaIdentidadPaciente(idEnlace) {
        const identidad = `${PREFIJO_PACIENTE}${idEnlace}-${randomBytes(6).toString("hex")}`;
        return { identidad, llave: `${identidad}.${firmar(`llave:${identidad}`)}` };
    }

    /** Identidad de la llave si su firma es válida; si no, null. */
    identidadDeLlave(llave) {
        if (typeof llave !== "string") return null;
        const punto = llave.lastIndexOf(".");
        if (punto <= 0) return null;
        const identidad = llave.slice(0, punto);
        if (!identidad.startsWith(PREFIJO_PACIENTE)) return null;
        try {
            return firmaCoincide(`llave:${identidad}`, llave.slice(punto + 1)) ? identidad : null;
        } catch {
            return null;
        }
    }

    esIdentidadDelEnlace(identidad, idEnlace) {
        return identidad.startsWith(`${PREFIJO_PACIENTE}${idEnlace}-`);
    }

    generarToken(identity, nombreSala) {

        const token = new AccessToken(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_API_KEY,
            process.env.TWILIO_API_SECRET,
            {
                identity: identity,
                ttl: DURACION_MAXIMA_LLAMADA_SEG
            }
        );

        // Autorizar acceso únicamente a esta sala
        const videoGrant = new AccessToken.VideoGrant({
            room: nombreSala
        });

        // Incorporar autorización al token
        token.addGrant(videoGrant);

        // Retornar JWT firmado
        return token.toJwt();
    }

    /** true si la sala sigue en curso. Una sala terminada (o que Twilio no encuentra) → false. */
    async salaEnCurso(sid) {
        try {
            const sala = await clienteTwilioVideo.video.v1.rooms(sid).fetch();
            return sala.status === "in-progress";
        } catch (error) {
            if (error?.status === 404) return false;
            throw error;
        }
    }

    /** Identidades de los pacientes que han estado en la sala (conectados o ya no). */
    async pacientesDeLaSala(sid) {
        const participantes = clienteTwilioVideo.video.v1.rooms(sid).participants;
        const [conectados, desconectados] = await Promise.all([
            participantes.list({ status: "connected", pageSize: 50 }),
            participantes.list({ status: "disconnected", pageSize: 50 }),
        ]);
        return [...conectados, ...desconectados]
            .map((p) => p.identity)
            .filter((identidad) => identidad.startsWith(PREFIJO_PACIENTE));
    }

    /** Termina la sala para todos. Si ya estaba terminada, no hace nada. */
    async finalizarSala(sid) {
        try {
            await clienteTwilioVideo.video.v1.rooms(sid).update({ status: "completed" });
        } catch (error) {
            // 404 o "la sala no está en curso": ya terminó.
            if (error?.status === 404 || error?.status === 400) return;
            throw error;
        }
    }

     crearSala = async (nombreSala) => {
        try {


            const sala = await clienteTwilioVideo.video.v1.rooms.create({

                uniqueName: nombreSala,
                type: "group",
                maxParticipants: 2,
                maxParticipantDuration: DURACION_MAXIMA_LLAMADA_SEG,
                emptyRoomTimeout: MINUTOS_SALA_VACIA,
                unusedRoomTimeout: MINUTOS_SALA_VACIA,
                recordParticipantsOnConnect: false

            });

            return {
                idSala: sala.sid,
                nombreSala: sala.uniqueName,
                estado: sala.status,
                tipo: sala.type
            };

        }catch (e) {
            throw new Error(`Error al crear la sala: ${e.message}. Contacte a soporte`);

        }
    };

}
