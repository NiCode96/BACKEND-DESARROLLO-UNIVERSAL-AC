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

            return res.status(200).json({
                message: "Sala creada exitosamente",
                success: true,
                data: respuestaService
            })

        }catch (e) {
            return res.status(500).json({
                message: e.message,
                success: false,
                data: null
            })
        }
    }
}