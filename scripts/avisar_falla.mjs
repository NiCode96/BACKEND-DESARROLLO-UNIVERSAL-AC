/* Avisa por correo que una tarea programada falló. Lo llama el cron después de `||`:
 *
 *   node scripts/verificar_cadena_firma.mjs >> logs/operacion.log 2>&1 \
 *     || node scripts/avisar_falla.mjs "Verificación de la cadena de firma"
 *
 * Destino: ALERTA_CORREO del .env (varios separados por coma). Envía con Brevo,
 * igual que el resto del backend (el servidor no tiene `mail`).
 *
 * El correo dice QUÉ tarea falló, en qué servidor y en qué base; nunca copia el
 * log: el detalle se lee en logs/operacion.log del servidor. Sale con código 1 si
 * no pudo avisar, para que el propio cron lo deje anotado. */

import "dotenv/config";
import { hostname } from "node:os";
import { enviarCorreo } from "../services/firma/correoFirma.js";
import { construirCorreoBase, construirTablaDetalle } from "../services/emailTemplateBase.js";

const tarea = process.argv.slice(2).join(" ").trim() || "Tarea programada";
const destinos = String(process.env.ALERTA_CORREO || "").split(",").map((c) => c.trim()).filter(Boolean);

if (!destinos.length) {
    console.error(`[ALERTA] ${tarea} falló, pero ALERTA_CORREO no está configurado.`);
    process.exit(1);
}

const cuando = new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short",
}).format(new Date());
const instancia = process.env.DB_DATABASE || "(sin DB_DATABASE)";

const html = construirCorreoBase({
    eyebrow: "Alerta de operación",
    titulo: `Falló: ${tarea}`,
    introHtml: "Una tarea programada del backend terminó con error. Revisar el log en el servidor.",
    contenidoHtml: construirTablaDetalle([
        { label: "Servidor", value: hostname() },
        { label: "Base", value: instancia },
        { label: "Hora (Chile)", value: cuando },
        { label: "Log", value: "logs/operacion.log" },
    ]),
    nombreEmpresa: "AgendaClínica",
});

let enviados = 0;
for (const para of destinos) {
    const ok = await enviarCorreo({
        empresa: { empresaNombre: "AgendaClínica · alertas" },
        para,
        asunto: `ALERTA ${instancia}: ${tarea}`,
        html,
    }).catch((error) => {
        console.error(`[ALERTA] no se pudo avisar a ${para}:`, error.message);
        return false;
    });
    if (ok) enviados++;
}

console.error(`[ALERTA] ${new Date().toISOString()} ${tarea} falló; aviso enviado a ${enviados}/${destinos.length}.`);
process.exit(enviados ? 0 : 1);
