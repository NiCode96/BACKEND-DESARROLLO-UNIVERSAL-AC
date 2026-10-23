import twilio from "twilio";

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


export default class TelemedicinaService {

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

