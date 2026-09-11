import DataBase from '../config/Database.js';
import { enviarRecordatorio_1hora } from './notificacionWhatsApp.js';
import { obtenerDatosEmpresaConfig } from './datosEmpresaConfig.js';
import { sendPushToAll } from './pushService.js';
import { construirCorreoBase, construirTablaDetalle, construirAviso, TEXTO_PRINCIPAL, TEXTO_SECUNDARIO } from './emailTemplateBase.js';

/**
 * SISTEMA DE RECORDATORIOS AUTOMÁTICOS DE CITAS
 *
 * Envía correos de recordatorio (email):
 * - 12 horas antes de la cita
 * - 6 horas antes de la cita
 *
 * Envía recordatorios por WhatsApp:
 * - 12 horas antes de la cita
 * - 6 horas antes de la cita
 * - 1 hora antes de la cita
 *
 * Envía recordatorios push/in-app (campana del dashboard) al profesional:
 * - 12 horas antes de la cita
 * - 6 horas antes de la cita
 * - 1 hora antes de la cita
 * (mismas ventanas ya calculadas abajo para email/WhatsApp, sin queries nuevas)
 *
 * Debe ejecutarse como cron job cada 5-10 minutos
 */

/**
 * Envía el correo de recordatorio usando Brevo API
 */
async function enviarCorreoRecordatorio({ email, nombrePaciente, apellidoPaciente, fecha, hora, tipoRecordatorio }) {
    const { BREVO_API_KEY, CORREO_REMITENTE } = process.env;
    const { correoEmpresa, nombreEmpresa, direccionEmpresa } = await obtenerDatosEmpresaConfig();

    if (!BREVO_API_KEY) {
        console.warn("[RECORDATORIO] BREVO_API_KEY no configurada. Correo no enviado.");
        return false;
    }

    if (!email) {
        console.warn("[RECORDATORIO] Email vacío. Correo no enviado.");
        return false;
    }

    const fromEmail = CORREO_REMITENTE;
    const fromName = nombreEmpresa || "Clinica";

    if (!fromEmail) {
        console.warn("[RECORDATORIO] CORREO_REMITENTE no configurado. Correo no enviado.");
        return false;
    }

    const horasRestantes = tipoRecordatorio === '12h' ? '12 horas' : '6 horas';
    const subject = `Recordatorio de cita programada - ${horasRestantes} restantes`;

    const contenidoHtml = `
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.7; color: ${TEXTO_PRINCIPAL};">
        Estimado/a <strong>${nombrePaciente} ${apellidoPaciente || ''}</strong>, le recordamos que mantiene una cita agendada según el siguiente detalle:
      </p>
      ${construirTablaDetalle([
          { label: "Fecha", value: fecha },
          { label: "Hora", value: hora },
          { label: "Lugar", value: direccionEmpresa }
      ])}
      ${construirAviso("Si no puede asistir, le agradeceremos avisar con anticipación para reprogramar su cita y liberar el cupo para otro paciente.")}
      <p style="margin: 20px 0 0 0; font-size: 14px; color: ${TEXTO_SECUNDARIO};">
        Quedamos atentos/as ante cualquier consulta o confirmación.
      </p>
    `;

    const html = construirCorreoBase({
        eyebrow: "Recordatorio de Cita",
        titulo: `Faltan ${horasRestantes} para su cita`,
        contenidoHtml,
        footerNota: "Correo automático del sistema de agendamiento. Por favor no responda a este mensaje.",
        nombreEmpresa: fromName
    });

    const text = `
Recordatorio de cita - ${fromName}

Estimado/a ${nombrePaciente} ${apellidoPaciente || ''}:

Le recordamos que mantiene una cita agendada según el siguiente detalle:

Fecha: ${fecha}
Hora: ${hora}
Lugar: ${direccionEmpresa}

Si no puede asistir, le agradeceremos avisar con anticipación para reprogramar su cita y liberar el cupo para otro paciente.

Quedamos atentos/as ante cualquier consulta o confirmación.

Atentamente,
${fromName}
  `;

    const payload = {
        sender: { name: fromName, email: fromEmail },
        to: [{ email }],
        replyTo: correoEmpresa ? { email: correoEmpresa, name: fromName } : undefined,
        subject,
        textContent: text,
        htmlContent: html
    };

    try {
        const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                accept: "application/json",
                "content-type": "application/json",
                "api-key": BREVO_API_KEY
            },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const errText = await resp.text().catch(() => "");
            console.error("[RECORDATORIO] Brevo error:", resp.status, errText);
            return false;
        }

        console.log(`[RECORDATORIO] Correo de ${tipoRecordatorio} enviado a ${email}`);
        return true;
    } catch (error) {
        console.error("[RECORDATORIO] Error al enviar correo:", error.message);
        return false;
    }
}

/**
 * Marca el recordatorio de email como enviado en la base de datos
 */
async function marcarRecordatorioEnviado(id_reserva, tipoRecordatorio) {
    try {
        const conexion = DataBase.getInstance();
        const campo = tipoRecordatorio === '12h' ? 'recordatorio12h' : 'recordatorio6h';
        const query = `UPDATE reservaPacientes SET ${campo} = 1 WHERE id_reserva = ?`;
        await conexion.ejecutarQuery(query, [id_reserva]);
        console.log(`[RECORDATORIO] Marcado ${tipoRecordatorio} para reserva ${id_reserva}`);
    } catch (error) {
        console.error(`[RECORDATORIO] Error al marcar recordatorio:`, error.message);
    }
}

/**
 * Marca el recordatorio de WhatsApp como enviado en la base de datos
 */
async function marcarRecordatorioWhatsAppEnviado(id_reserva, tipoRecordatorio) {
    try {
        const conexion = DataBase.getInstance();
        const campos = { '12h': 'wspRecordatorio12h', '6h': 'wspRecordatorio6h', '1h': 'wspRecordatorio1h' };
        const campo = campos[tipoRecordatorio];
        if (!campo) return;
        const query = `UPDATE reservaPacientes SET ${campo} = 1 WHERE id_reserva = ?`;
        await conexion.ejecutarQuery(query, [id_reserva]);
        console.log(`[WSP-RECORDATORIO] Marcado ${tipoRecordatorio} para reserva ${id_reserva}`);
    } catch (error) {
        console.error(`[WSP-RECORDATORIO] Error al marcar recordatorio:`, error.message);
    }
}

/**
 * Marca el recordatorio push/in-app como enviado en la base de datos
 */
async function marcarRecordatorioPushEnviado(id_reserva, tipoRecordatorio) {
    try {
        const conexion = DataBase.getInstance();
        const campos = { '12h': 'pushRecordatorio12h', '6h': 'pushRecordatorio6h', '1h': 'pushRecordatorio1h' };
        const campo = campos[tipoRecordatorio];
        if (!campo) return;
        const query = `UPDATE reservaPacientes SET ${campo} = 1 WHERE id_reserva = ?`;
        await conexion.ejecutarQuery(query, [id_reserva]);
        console.log(`[PUSH-RECORDATORIO] Marcado ${tipoRecordatorio} para reserva ${id_reserva}`);
    } catch (error) {
        console.error(`[PUSH-RECORDATORIO] Error al marcar recordatorio:`, error.message);
    }
}

/**
 * Inserta la notificación en el feed in-app que consume la campana del dashboard.
 * Nunca lanza: si falla, el push por navegador igual se intenta enviar.
 */
async function crearNotificacionInapp({ id_reserva, id_profesional, titulo, descripcion, fecha_evento }) {
    try {
        const conexion = DataBase.getInstance();
        await conexion.ejecutarQuery(
            `INSERT INTO notificaciones_inapp (id_reserva, id_profesional, titulo, descripcion, fecha_evento, tipo)
             VALUES (?, ?, ?, ?, ?, 'cita')`,
            [id_reserva, id_profesional || null, titulo, descripcion || null, fecha_evento || null]
        );
    } catch (error) {
        console.error('[PUSH-RECORDATORIO] Error creando notificación in-app:', error.message);
    }
}

/**
 * Obtiene las reservas que necesitan recordatorio
 * Busca citas entre 5.5 y 12.5 horas en el futuro
 */
// true una vez que detectamos que las columnas pushRecordatorio* no existen todavía
// (migration_notificaciones_ics.sql no corrida). Evita repetir el intento fallido en
// cada ciclo del cron y, sobre todo, evita que el recordatorio de email/WhatsApp
// (que SÍ funciona hoy) se caiga por culpa de una migración pendiente.
let columnasPushDisponibles = true;

const CAMPOS_BASE = `
        id_reserva,
        id_profesional,
        nombrePaciente,
        apellidoPaciente,
        email,
        telefono,
        fechaInicio,
        horaInicio,
        estadoReserva,
        motivo_reserva,
        COALESCE(recordatorio12h, 0) as recordatorio12h,
        COALESCE(recordatorio6h, 0) as recordatorio6h,
        COALESCE(wspRecordatorio12h, 0) as wspRecordatorio12h,
        COALESCE(wspRecordatorio6h, 0) as wspRecordatorio6h,
        COALESCE(wspRecordatorio1h, 0) as wspRecordatorio1h,
        TIMESTAMPDIFF(MINUTE, NOW(), TIMESTAMP(fechaInicio, horaInicio)) as minutos_restantes`;

const CAMPOS_PUSH = `,
        COALESCE(pushRecordatorio12h, 0) as pushRecordatorio12h,
        COALESCE(pushRecordatorio6h, 0) as pushRecordatorio6h,
        COALESCE(pushRecordatorio1h, 0) as pushRecordatorio1h`;

const CONDICION_VENTANA = `
      FROM reservaPacientes
      WHERE estadoReserva IN ('reservada', 'CONFIRMADA')
        AND estadoPeticion <> 0
        AND TIMESTAMP(fechaInicio, horaInicio) > NOW()
        AND TIMESTAMP(fechaInicio, horaInicio) <= DATE_ADD(NOW(), INTERVAL 13 HOUR)
    `;

/**
 * Obtiene las reservas que necesitan recordatorio
 * Busca citas entre 0 y 13 horas en el futuro
 */
async function obtenerReservasParaRecordatorio() {
    const conexion = DataBase.getInstance();

    if (columnasPushDisponibles) {
        try {
            const query = `SELECT${CAMPOS_BASE}${CAMPOS_PUSH}${CONDICION_VENTANA}`;
            const reservas = await conexion.ejecutarQuery(query);
            return Array.isArray(reservas) ? reservas : [];
        } catch (error) {
            const noExisteColumna = error?.code === "ER_BAD_FIELD_ERROR"
                || String(error?.message || "").toLowerCase().includes("unknown column");

            if (!noExisteColumna) {
                console.error("[RECORDATORIO] Error al obtener reservas:", error.message);
                return [];
            }

            columnasPushDisponibles = false;
            console.warn("[PUSH-RECORDATORIO] Columnas pushRecordatorio* no existen todavía " +
                "(falta correr migration_notificaciones_ics.sql). Recordatorios push/in-app " +
                "deshabilitados; email y WhatsApp siguen funcionando con normalidad.");
            // cae al fallback de abajo en este mismo intento, sin esperar al próximo ciclo del cron
        }
    }

    try {
        const query = `SELECT${CAMPOS_BASE}${CONDICION_VENTANA}`;
        const reservas = await conexion.ejecutarQuery(query);
        return Array.isArray(reservas) ? reservas.map(r => ({
            ...r, pushRecordatorio12h: 1, pushRecordatorio6h: 1, pushRecordatorio1h: 1
        })) : [];
    } catch (error) {
        console.error("[RECORDATORIO] Error al obtener reservas:", error.message);
        return [];
    }
}

/**
 * Formatea la fecha para mostrar en el correo
 */
function formatearFecha(fechaStr) {
    const fecha = new Date(fechaStr);
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return fecha.toLocaleDateString('es-CL', opciones);
}

// mysql2 devuelve columnas DATE como objeto Date de JS (no como string), así que no se
// puede usar String(fecha).slice(0,10) directamente. Usa getters locales para no
// arrastrar corrimientos de huso horario.
function fechaISOCorta(fecha) {
    if (!fecha) return '';
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    if (Number.isNaN(d.getTime())) return String(fecha).slice(0, 10);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * FUNCIÓN PRINCIPAL - Ejecutar como cron job cada 5-10 minutos
 *
 * Revisa todas las reservas próximas y envía recordatorios:
 * - 12 horas antes: email + WhatsApp (690-750 minutos)
 * - 6 horas antes: email + WhatsApp (330-390 minutos)
 * - 1 hora antes: WhatsApp (30-90 minutos)
 */
// Evita que dos corridas del cron se solapen si una demora más de 5 minutos
// (ej. Brevo/Twilio lentos) — sin esto, ambas podrían intentar mandar el mismo
// recordatorio antes de que la primera alcance a marcarlo como enviado.
let corriendoRecordatorios = false;

export async function ejecutarRecordatoriosAutomaticos() {
    if (corriendoRecordatorios) {
        console.warn("[RECORDATORIO] Ejecución anterior aún en curso, se omite este ciclo.");
        return { enviados: 0, errores: 0, omitido: true };
    }
    corriendoRecordatorios = true;

    try {
        return await ejecutarRecordatoriosAutomaticosInterno();
    } finally {
        corriendoRecordatorios = false;
    }
}

async function ejecutarRecordatoriosAutomaticosInterno() {
    console.log("[RECORDATORIO] ========================================");
    console.log("[RECORDATORIO] Iniciando proceso de recordatorios...");
    console.log("[RECORDATORIO] Fecha/Hora actual:", new Date().toLocaleString('es-CL'));

    try {
        const reservas = await obtenerReservasParaRecordatorio();

        if (reservas.length === 0) {
            console.log("[RECORDATORIO] No hay reservas próximas para recordar.");
            console.log("[RECORDATORIO] ========================================");
            return { enviados: 0, errores: 0 };
        }

        console.log(`[RECORDATORIO] Encontradas ${reservas.length} reserva(s) próxima(s)`);

        let enviados = 0;
        let errores = 0;

        for (const reserva of reservas) {
            const {
                id_reserva,
                id_profesional,
                nombrePaciente,
                apellidoPaciente,
                email,
                telefono,
                fechaInicio,
                horaInicio,
                motivo_reserva,
                recordatorio12h,
                recordatorio6h,
                wspRecordatorio12h,
                wspRecordatorio6h,
                wspRecordatorio1h,
                pushRecordatorio12h,
                pushRecordatorio6h,
                pushRecordatorio1h,
                minutos_restantes
            } = reserva;

            console.log(`[RECORDATORIO] Procesando reserva ${id_reserva}: ${nombrePaciente} - ${minutos_restantes} minutos restantes`);

            // Recordatorio push/in-app para el profesional (campana del dashboard). Envío
            // global por ahora (todas las suscripciones activas), sin filtrar por
            // id_profesional — ver nota en migration_notificaciones_ics.sql.
            const enviarRecordatorioPush = async (tipoRecordatorio, etiquetaTiempo) => {
                await crearNotificacionInapp({
                    id_reserva,
                    id_profesional,
                    titulo: `Cita en ${etiquetaTiempo}`,
                    descripcion: `${nombrePaciente} ${apellidoPaciente || ''}${motivo_reserva ? ' · ' + motivo_reserva : ''}`.trim(),
                    fecha_evento: `${fechaISOCorta(fechaInicio)} ${horaInicio}`
                });
                await sendPushToAll(
                    `Cita en ${etiquetaTiempo}`,
                    `${nombrePaciente} ${apellidoPaciente || ''}`.trim(),
                    '/dashboard/agendaCitas'
                );
                await marcarRecordatorioPushEnviado(id_reserva, tipoRecordatorio);
            };

            // ===== RECORDATORIOS DE 12 HORAS (entre 690 y 750 minutos = 11.5h a 12.5h) =====
            if (minutos_restantes >= 690 && minutos_restantes <= 750) {
                // Email 12h
                if (!recordatorio12h) {
                    console.log(`[RECORDATORIO] Enviando correo de 12h a ${email}...`);
                    const enviado = await enviarCorreoRecordatorio({
                        email, nombrePaciente, apellidoPaciente,
                        fecha: formatearFecha(fechaInicio), hora: horaInicio,
                        tipoRecordatorio: '12h'
                    });
                    if (enviado) { await marcarRecordatorioEnviado(id_reserva, '12h'); enviados++; }
                    else { errores++; }
                }

                // Push/in-app 12h
                if (!pushRecordatorio12h) {
                    await enviarRecordatorioPush('12h', '12 horas');
                }
            }

            // ===== RECORDATORIOS DE 6 HORAS (entre 330 y 390 minutos = 5.5h a 6.5h) =====
            if (minutos_restantes >= 330 && minutos_restantes <= 390) {
                // Email 6h
                if (!recordatorio6h) {
                    console.log(`[RECORDATORIO] Enviando correo de 6h a ${email}...`);
                    const enviado = await enviarCorreoRecordatorio({
                        email, nombrePaciente, apellidoPaciente,
                        fecha: formatearFecha(fechaInicio), hora: horaInicio,
                        tipoRecordatorio: '6h'
                    });
                    if (enviado) { await marcarRecordatorioEnviado(id_reserva, '6h'); enviados++; }
                    else { errores++; }
                }

                // Push/in-app 6h
                if (!pushRecordatorio6h) {
                    await enviarRecordatorioPush('6h', '6 horas');
                }
            }

            // ===== RECORDATORIO DE 1 HORA (entre 30 y 90 minutos = 0.5h a 1.5h) =====
            if (minutos_restantes >= 30 && minutos_restantes <= 90) {
                // WhatsApp 1h
                if (!wspRecordatorio1h) {
                    console.log(`[WSP-RECORDATORIO] Enviando WhatsApp de 1h a ${telefono}...`);
                    const enviado = await enviarRecordatorio_1hora({
                        telefono,
                        nombre: nombrePaciente,
                        fecha: formatearFecha(fechaInicio),
                        hora: horaInicio
                    });
                    if (enviado) { await marcarRecordatorioWhatsAppEnviado(id_reserva, '1h'); enviados++; }
                    else { errores++; }
                }

                // Push/in-app 1h
                if (!pushRecordatorio1h) {
                    await enviarRecordatorioPush('1h', '1 hora');
                }
            }
        }

        console.log(`[RECORDATORIO] Proceso finalizado. Enviados: ${enviados}, Errores: ${errores}`);
        console.log("[RECORDATORIO] ========================================");

        return { enviados, errores };
    } catch (error) {
        console.error("[RECORDATORIO] Error en el proceso:", error.message);
        console.log("[RECORDATORIO] ========================================");
        return { enviados: 0, errores: 1 };
    }
}

/**
 * Función para enviar recordatorio manual (útil para testing)
 */
export async function enviarRecordatorioManual({ email, nombrePaciente, apellidoPaciente, fecha, hora }) {
    return await enviarCorreoRecordatorio({
        email,
        nombrePaciente,
        apellidoPaciente,
        fecha,
        hora,
        tipoRecordatorio: 'manual'
    });
}

/**
 * Limpieza periódica del feed de notificaciones in-app (leídas o con más de 7 días).
 * Pensada para correr en un cron aparte y liviano (cada 30 min), no en cada
 * request del frontend.
 */
export async function limpiarNotificacionesInappAntiguas() {
    try {
        await DataBase.getInstance().ejecutarQuery(
            `DELETE FROM notificaciones_inapp
             WHERE visto = 1 OR creado_en < DATE_SUB(NOW(), INTERVAL 7 DAY)`,
            []
        );
    } catch (error) {
        console.error('[PUSH-RECORDATORIO] Error limpiando notificaciones in-app:', error.message);
    }
}
