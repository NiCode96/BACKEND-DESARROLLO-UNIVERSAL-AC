import TelemedicinaService from "../services/telemedicina.js";
import { randomUUID } from "node:crypto";
import Pacientes from "../model/Pacientes.js";
import DatosEmpresa from "../model/DatosEmpresa.js";
import { esRolClinico } from "../services/firma/roles.js";
import { CORREO_VALIDO, enmascararCorreo } from "../services/firma/plantillas.js";
import { enviarCorreo } from "../services/firma/correoFirma.js";
import { htmlInvitacionVideollamada } from "../services/correoVideollamada.js";

const SALA_VALIDA = /^telemedicina-[0-9a-f-]{36}$/;

/** Enlace que abre el paciente. Mismo formato que "Copiar enlace" del front. */
function enlaceSala(nombreSala, invitacion) {
    const base = String(process.env.URL_PUBLICA_SITIO || "").trim().replace(/\/$/, "");
    if (!base) return null;
    const url = new URL(`${base}/telemedicina/${encodeURIComponent(nombreSala)}`);
    url.searchParams.set("i", invitacion);
    return url.toString();
}

export default class TelemedicinaController {
    constructor() {
    }


    static async nuevaSalaTelemedicina(req, res){
        try {
            const telemedicinaService = new TelemedicinaService();
            const nombreSala = `telemedicina-${randomUUID()}`;
            // Nombre del profesional que se muestra en la página del paciente;
            // viaja dentro de la invitación firmada.
            const nombreProfesional = typeof req.body?.nombreProfesional === "string"
                ? req.body.nombreProfesional.trim().slice(0, 80)
                : "";
            const respuestaService = await telemedicinaService.crearSala(nombreSala);
            const invitacion = telemedicinaService.generarInvitacion(nombreSala, nombreProfesional);

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

    // POST /telemedicina/enviarInvitacionCorreo { id_paciente, nombreSala, invitacion }
    // El enlace va al correo YA REGISTRADO en la ficha del paciente, nunca a uno que mande
    // el navegador. Solo con una invitación vigente de esa sala (la que creó el profesional).
    // Por WhatsApp no pasa por aquí: el front abre el WhatsApp del propio profesional.
    static async enviarInvitacionCorreo(req, res) {
        try {
            if (!esRolClinico(req.usuario)) return res.status(403).json({ message: "sinPermiso" });
            const id_paciente = Number(req.body?.id_paciente);
            const nombreSala = String(req.body?.nombreSala ?? "");
            const invitacion = req.body?.invitacion;
            if (!id_paciente || !SALA_VALIDA.test(nombreSala) || typeof invitacion !== "string") {
                return res.status(400).json({ message: "sindata" });
            }

            const datos = new TelemedicinaService().datosInvitacion(nombreSala, invitacion);
            if (!datos) return res.status(403).json({ message: "invitacionInvalida" });

            const paciente = (await new Pacientes().selectPacienteEspecifico(id_paciente))?.[0];
            if (!paciente) return res.status(404).json({ message: "noEncontrado" });
            const correo = String(paciente.correo ?? "").trim();
            if (!CORREO_VALIDO.test(correo)) return res.status(422).json({ message: "sinDatoContacto" });

            const enlace = enlaceSala(nombreSala, invitacion);
            if (!enlace) {
                console.error("[TELEMEDICINA] falta URL_PUBLICA_SITIO para armar el enlace");
                return res.status(503).json({ message: "servicioOcupado" });
            }

            const empresa = (await new DatosEmpresa().seleccionarDatosEmpresa())?.[0] || {};
            const nombrePaciente = String(paciente.nombre ?? "").trim().split(/\s+/)[0] || "";
            const enviado = await enviarCorreo({
                empresa,
                para: correo,
                nombre: nombrePaciente || undefined,
                asunto: `Tu videoconsulta${empresa.empresaNombre ? ` - ${empresa.empresaNombre}` : ""}`,
                html: htmlInvitacionVideollamada({
                    empresa, nombrePaciente, nombreProfesional: datos.nombreProfesional, enlace, expira: datos.expira,
                }),
            }).catch((error) => {
                console.error("[TELEMEDICINA] envío del enlace por correo:", error.message);
                return false;
            });
            if (!enviado) return res.status(503).json({ message: "servicioOcupado" });

            // Sin datos del paciente en el log: solo quién envió y a qué ficha.
            console.log(`[TELEMEDICINA] enlace enviado por correo · ficha ${id_paciente} · usuario ${req.usuario.clerkId}`);
            return res.status(200).json({ message: true, destino: enmascararCorreo(correo) });
        } catch (error) {
            console.error("[TELEMEDICINA] enviarInvitacionCorreo:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }
}
