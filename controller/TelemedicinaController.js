import TelemedicinaService, { IDENTIDAD_PROFESIONAL, huellaCreador } from "../services/telemedicina.js";
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

/** Invitación y su vencimiento. Además de la hora (`expira`, para el correo) va lo que le
 *  queda en segundos: el front cuenta con eso y no con su reloj, que puede estar corrido. */
function datosInvitacionFront(servicio, nombreSala, invitacion) {
    const { expira } = servicio.leerInvitacion(nombreSala, invitacion);
    return { nombreSala, invitacion, expira, segundosRestantes: Math.max(0, Math.round((expira - Date.now()) / 1000)) };
}

/* Sala del profesional que llama: sesión con rol clínico, invitación con firma válida
 * (vencida sirve: solo identifica la sala) y creada por él. Si algo no cuadra responde
 * el error y devuelve null. */
function salaDelProfesional(req, res, servicio) {
    if (!esRolClinico(req.usuario)) { res.status(403).json({ message: "sinPermiso" }); return null; }
    const nombreSala = String(req.body?.nombreSala ?? "");
    if (!SALA_VALIDA.test(nombreSala) || typeof req.body?.invitacion !== "string") {
        res.status(400).json({ message: "sindata" }); return null;
    }
    const datos = servicio.leerInvitacion(nombreSala, req.body.invitacion);
    if (!datos) { res.status(403).json({ message: "invitacionInvalida" }); return null; }
    if (datos.creador !== huellaCreador(req.usuario.clerkId)) { res.status(403).json({ message: "sinPermiso" }); return null; }
    return datos;
}

export default class TelemedicinaController {
    constructor() {
    }


    // POST /telemedicina/nuevaSala { nombreProfesional }
    static async nuevaSalaTelemedicina(req, res){
        try {
            if (!esRolClinico(req.usuario)) return res.status(403).json({ message: "sinPermiso", success: false, data: null });
            const telemedicinaService = new TelemedicinaService();
            const nombreSala = `telemedicina-${randomUUID()}`;
            // Nombre del profesional que se muestra en la página del paciente;
            // viaja dentro de la invitación firmada.
            const nombreProfesional = typeof req.body?.nombreProfesional === "string"
                ? req.body.nombreProfesional.trim().slice(0, 80)
                : "";
            const sala = await telemedicinaService.crearSala(nombreSala);
            const invitacion = telemedicinaService.generarInvitacion({
                nombreSala, sid: sala.idSala, nombreProfesional, creador: huellaCreador(req.usuario.clerkId),
            });

            console.log(`[TELEMEDICINA] sala creada · usuario ${req.usuario.clerkId}`);

            return res.status(200).json({
                message: "Sala creada exitosamente",
                success: true,
                data: { ...sala, ...datosInvitacionFront(telemedicinaService, nombreSala, invitacion) }
            })

        }catch (e) {
            console.error("[TELEMEDICINA] nuevaSala:", e.message);
            return res.status(500).json({
                message: e.message,
                success: false,
                data: null
            })
        }
    }

    // POST /telemedicina/tokenProfesional { nombreSala, invitacion }
    // El profesional entra (o vuelve si se le cortó) a SU sala mientras siga en curso.
    static async tokenProfesional(req, res) {
        try {
            const servicio = new TelemedicinaService();
            const datos = salaDelProfesional(req, res, servicio);
            if (!datos) return;
            if (!(await servicio.salaEnCurso(datos.sid))) return res.status(410).json({ message: "salaFinalizada" });
            return res.status(200).json({ success: true, data: servicio.generarToken(IDENTIDAD_PROFESIONAL, datos.sala) });
        } catch (error) {
            console.error("[TELEMEDICINA] tokenProfesional:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }

    // POST /telemedicina/tokenSala { nombreSala, invitacion, llave? }  (pública: el paciente)
    // Entra quien trae un enlace vigente (15 min) que nadie haya usado todavía, o el paciente
    // que ya entró, con su llave (si se le cortó). Nunca a una sala terminada.
    static async nuevaTokenSala(req, res){
        try {
            const nombreSala = String(req.body?.nombreSala ?? "");
            const { invitacion, llave } = req.body ?? {};
            if (!SALA_VALIDA.test(nombreSala) || typeof invitacion !== "string") {
                return res.status(400).json({ message: "sindata", success: false, data: null });
            }

            const servicio = new TelemedicinaService();
            const datos = servicio.leerInvitacion(nombreSala, invitacion);
            if (!datos) return res.status(403).json({ message: "invitacionInvalida", success: false, data: null });

            if (!(await servicio.salaEnCurso(datos.sid))) {
                return res.status(410).json({ message: "salaFinalizada", success: false, data: null });
            }

            const pacientes = await servicio.pacientesDeLaSala(datos.sid);

            // Vuelve el mismo paciente (su llave es de esta sala): pasa aunque el enlace haya vencido.
            const identidadLlave = servicio.identidadDeLlave(llave);
            if (identidadLlave && pacientes.includes(identidadLlave)) {
                return res.status(200).json({ success: true, data: { token: servicio.generarToken(identidadLlave, nombreSala), llave } });
            }

            if (pacientes.some((identidad) => servicio.esIdentidadDelEnlace(identidad, datos.n))) {
                return res.status(409).json({ message: "enlaceUsado", success: false, data: null });
            }
            if (!datos.vigente) return res.status(410).json({ message: "enlaceVencido", success: false, data: null });

            const nuevo = servicio.nuevaIdentidadPaciente(datos.n);
            return res.status(200).json({
                success: true,
                data: { token: servicio.generarToken(nuevo.identidad, nombreSala), llave: nuevo.llave },
            });

        }catch (e) {
            console.error("[TELEMEDICINA] tokenSala:", e.message);
            return res.status(500).json({
                message: "serverError",
                success: false,
                data: null
            })
        }
    }

    // POST /telemedicina/renovarInvitacion { nombreSala, invitacion }
    // Cada envío (WhatsApp, copiar) pide un enlace nuevo con 15 minutos nuevos.
    static async renovarInvitacion(req, res) {
        try {
            const servicio = new TelemedicinaService();
            const datos = salaDelProfesional(req, res, servicio);
            if (!datos) return;
            if (!(await servicio.salaEnCurso(datos.sid))) return res.status(410).json({ message: "salaFinalizada" });
            const invitacion = servicio.renovarInvitacion(datos);
            return res.status(200).json({ message: true, ...datosInvitacionFront(servicio, datos.sala, invitacion) });
        } catch (error) {
            console.error("[TELEMEDICINA] renovarInvitacion:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }

    // POST /telemedicina/finalizarSala { nombreSala, invitacion }
    // "Salir" del profesional: termina la sala para los dos y deja muertos todos sus enlaces.
    static async finalizarSala(req, res) {
        try {
            const servicio = new TelemedicinaService();
            const datos = salaDelProfesional(req, res, servicio);
            if (!datos) return;
            await servicio.finalizarSala(datos.sid);
            console.log(`[TELEMEDICINA] sala finalizada · usuario ${req.usuario.clerkId}`);
            return res.status(200).json({ message: true });
        } catch (error) {
            console.error("[TELEMEDICINA] finalizarSala:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }

    // POST /telemedicina/enviarInvitacionCorreo { id_paciente, nombreSala, invitacion }
    // El enlace va al correo YA REGISTRADO en la ficha del paciente, nunca a uno que mande
    // el navegador. Se envía un enlace NUEVO (15 minutos desde este envío) y se devuelve
    // para que el front reinicie la cuenta regresiva.
    // Por WhatsApp no pasa por aquí: el front abre el WhatsApp del propio profesional.
    static async enviarInvitacionCorreo(req, res) {
        try {
            const servicio = new TelemedicinaService();
            const datos = salaDelProfesional(req, res, servicio);
            if (!datos) return;
            const id_paciente = Number(req.body?.id_paciente);
            if (!id_paciente) return res.status(400).json({ message: "sindata" });

            const paciente = (await new Pacientes().selectPacienteEspecifico(id_paciente))?.[0];
            if (!paciente) return res.status(404).json({ message: "noEncontrado" });
            const correo = String(paciente.correo ?? "").trim();
            if (!CORREO_VALIDO.test(correo)) return res.status(422).json({ message: "sinDatoContacto" });

            if (!(await servicio.salaEnCurso(datos.sid))) return res.status(410).json({ message: "salaFinalizada" });
            const invitacion = servicio.renovarInvitacion(datos);
            const nueva = datosInvitacionFront(servicio, datos.sala, invitacion);

            const enlace = enlaceSala(datos.sala, invitacion);
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
                    empresa, nombrePaciente, nombreProfesional: datos.prof, enlace, expira: nueva.expira,
                }),
            }).catch((error) => {
                console.error("[TELEMEDICINA] envío del enlace por correo:", error.message);
                return false;
            });
            if (!enviado) return res.status(503).json({ message: "servicioOcupado" });

            // Sin datos del paciente en el log: solo quién envió y a qué ficha.
            console.log(`[TELEMEDICINA] enlace enviado por correo · ficha ${id_paciente} · usuario ${req.usuario.clerkId}`);
            return res.status(200).json({ message: true, destino: enmascararCorreo(correo), ...nueva });
        } catch (error) {
            console.error("[TELEMEDICINA] enviarInvitacionCorreo:", error.message);
            return res.status(500).json({ message: "serverError" });
        }
    }
}
