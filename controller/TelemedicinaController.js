import TelemedicinaService from "../services/telemedicina.js";
import { randomUUID } from "node:crypto";

export default class TelemedicinaController {
    constructor() {
    }


    static async nuevaSalaTelemedicina(req, res){
        try {
            const telemedicinaService = new TelemedicinaService();
            const nombreSala = `telemedicina-${randomUUID()}`;
            const respuestaService = await telemedicinaService.crearSala(nombreSala);
            const invitacion = telemedicinaService.generarInvitacion(nombreSala);

            console.log("############### CONTROLLER : FUNCION LLAMADA --> nuevaSalaTelemedicina");

            return res.status(200).json({
                message: "Sala creada exitosamente",
                success: true,
                data: { ...respuestaService, invitacion }
            })

        }catch (e) {
            return res.status(500).json({
                message: e.message,
                success: false,
                data: null
            })
        }
    }

    static async nuevaTokenSala(req, res){
        try {
            const {identity, nombreSala, invitacion} = req.body;

            if(!identity || !nombreSala || !invitacion){
                return res.status(400).json({
                    message: `No se pudo crear el acceso a la sala de telemedicna contacte a proveedor`,
                    success: false,
                    data: null
                })
            }

            const telemedicinaService = new TelemedicinaService();
            if (!telemedicinaService.validarInvitacion(nombreSala, invitacion)) {
                return res.status(403).json({
                    message: "La invitación no es válida o ya expiró.",
                    success: false,
                    data: null
                });
            }
            const respuestaService = await telemedicinaService.generarToken(identity, nombreSala);

            console.log("############### CONTROLLER : FUNCION LLAMADA --> nuevaTokenSala");

            return res.status(200).json({
                message: "Token generado exitosamente",
                success: true,
                data: respuestaService
            });

        }catch (e) {
            return res.status(400).json({
                message: `No se pudo crear el acceso a la sala de telemedicna contacte a proveedor`,
                success: false,
                data: null
            })
        }
    }


}

