import twilio from "twilio";
import { createHmac, timingSafeEqual } from "node:crypto";

const DURACION_INVITACION_MS = 4 * 60 * 60 * 1000;

function obtenerFirmaInvitacion(payload) {
    const secret = process.env.TWILIO_API_SECRET;
    if (!secret) throw new Error("Falta configurar TWILIO_API_SECRET");
    return createHmac("sha256", secret).update(payload).digest("base64url");
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

    generarInvitacion(nombreSala) {
        const payload = Buffer.from(JSON.stringify({
            nombreSala,
            expira: Date.now() + DURACION_INVITACION_MS
        })).toString("base64url");
        return `${payload}.${obtenerFirmaInvitacion(payload)}`;
    }

    validarInvitacion(nombreSala, invitacion) {
        try {
            if (typeof invitacion !== "string") return false;
            const [payload, firma] = invitacion.split(".");
            if (!payload || !firma) return false;

            const firmaEsperada = Buffer.from(obtenerFirmaInvitacion(payload), "base64url");
            const firmaRecibida = Buffer.from(firma, "base64url");
            if (firmaEsperada.length !== firmaRecibida.length || !timingSafeEqual(firmaEsperada, firmaRecibida)) {
                return false;
            }

            const datos = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
            return datos.nombreSala === nombreSala && Number(datos.expira) > Date.now();
        } catch {
            return false;
        }
    }

    generarToken(identity, nombreSala) {

        const token = new AccessToken(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_API_KEY,
            process.env.TWILIO_API_SECRET,
            {
                identity: identity,
                ttl: 4 * 60 * 60
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

    async obtenerSala(nombreSala) {
        const sala = await clienteTwilioVideo.video.v1
            .rooms(nombreSala)
            .fetch();

        return sala;
    }


     crearSala = async (nombreSala) => {
        try {


            const sala = await clienteTwilioVideo.video.v1.rooms.create({

                uniqueName: nombreSala,
                type: "group",
                maxParticipants: 2,
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

