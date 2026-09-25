import DataBase from '../config/Database.js';

const db = () => DataBase.getInstance();

// estadoPeticion = 0 son reservas que expiraron sin pagar; el cron las marca
// así y la app no las muestra. Contarlas haría parecer más activa a una
// clínica con muchos abandonos de pago.
const SOLO_VISIBLES = 'estadoPeticion <> 0';

export default class HealthMetricsController {
    constructor() {}

    // FUNCION QUE ENTREGA LAS METRICAS DE USO A NATIVECODE FINANCE
    static async obtenerMetricas(req, res) {
        try {
            const [diasSinActividad, reservas, confirmaciones, fichasClinicas] =
                await Promise.all([
                    calcularDiasSinActividad(),
                    contarReservas(),
                    calcularConfirmaciones(),
                    contarFichas(),
                ]);

            res.status(200).json({
                diasSinActividad,
                tendenciaSemanal: null, // la calcula Finance desde su serie diaria
                reservas,
                confirmaciones,
                fichasClinicas,
            });
        } catch (error) {
            console.error('[HEALTH METRICS]', error.message);
            res.status(500).json({ message: "serverError" });
        }
    }

    // FUNCION PARA REGISTRAR QUE ALGUIEN INGRESO A LA PLATAFORMA
    static async registrarAcceso(req, res) {
        try {
            const u = req.usuario; // lo deja verificarUsuarioClerk, puede ser null

            // Un registro por usuario por hora: suficiente para "días sin
            // actividad" y evita que un F5 nervioso o una pestaña abierta
            // inflen la tabla con miles de filas por día.
            const recientes = await db().ejecutarQuery(`
                SELECT 1 FROM registro_accesos
                 WHERE ocurrido_en >= NOW() - INTERVAL 1 HOUR
                   AND (usuario_clerk_id = ? OR (usuario_clerk_id IS NULL AND ? IS NULL))
                 LIMIT 1
            `, [u?.clerkId || null, u?.clerkId || null]);

            if (recientes.length === 0) {
                await db().ejecutarQuery(`
                    INSERT INTO registro_accesos
                        (usuario_clerk_id, usuario_email, usuario_nombre, rol,
                         id_profesional, ip, user_agent)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    u?.clerkId || null,
                    u?.email || null,
                    u?.nombre || null,
                    u?.rol || null,
                    u?.idProfesional || null,
                    req.ip || null,
                    String(req.headers['user-agent'] || '').slice(0, 255),
                ]);
            }

            res.status(200).json({ message: true });
        } catch (error) {
            console.error('[HEALTH METRICS] acceso:', error.message);
            // Nunca romper la app del cliente por telemetría: responde 200 igual.
            res.status(200).json({ message: true });
        }
    }
}

/**
 * Métrica 1 — la más importante (35% del score).
 * Días desde el último ingreso registrado. Devuelve null si nunca se registró
 * ninguno: null y 0 son distintos, y Finance los distingue para no marcar como
 * crítico a un cliente que simplemente no se pudo medir.
 */
async function calcularDiasSinActividad() {
    const filas = await db().ejecutarQuery(
        `SELECT DATEDIFF(NOW(), MAX(ocurrido_en)) AS dias FROM registro_accesos`, []
    );
    const dias = filas?.[0]?.dias;
    return dias === null || dias === undefined ? null : Number(dias);
}

/**
 * Métrica 3 — total acumulado de reservas. Finance guarda este número cada día
 * y saca la actividad de los últimos 30 días restando. Por eso acá NO se filtra
 * por fecha: mandar el acumulado completo es justo lo que se necesita.
 */
async function contarReservas() {
    const filas = await db().ejecutarQuery(
        `SELECT COUNT(*) AS total FROM reservaPacientes WHERE ${SOLO_VISIBLES}`, []
    );
    return Number(filas?.[0]?.total || 0);
}

/**
 * Métrica 4 — % de asistencia real de los últimos 30 días.
 *
 * Esta sí se acota por fecha sin columnas nuevas, porque fechaInicio (la fecha
 * de la CITA) ya existe. Solo cuentan citas que YA OCURRIERON: una reserva para
 * la semana que viene sigue en 'reservada' y contarla hundiría el porcentaje.
 *
 * Estados reales en la base: reservada, confirmada, anulada, no asiste, asiste.
 * La columna es texto libre sin validación, por eso se compara con LOWER/TRIM.
 */
async function calcularConfirmaciones() {
    const filas = await db().ejecutarQuery(`
        SELECT COUNT(*) AS total,
               SUM(LOWER(TRIM(estadoReserva)) = 'asiste') AS asistieron
          FROM reservaPacientes
         WHERE ${SOLO_VISIBLES}
           AND fechaInicio >= CURDATE() - INTERVAL 30 DAY
           AND fechaInicio <  CURDATE()
           AND LOWER(TRIM(estadoReserva)) <> 'anulada'
    `, []);

    const total = Number(filas?.[0]?.total || 0);
    if (total === 0) return null; // sin citas pasadas no hay porcentaje que calcular
    return Math.round((Number(filas[0].asistieron || 0) / total) * 100);
}

/**
 * Métrica 5 — total acumulado de fichas clínicas. Mismo criterio que reservas:
 * Finance deriva la ventana de 30 días desde su serie.
 * No se usa fechaConsulta porque la escribe el profesional a mano y es editable.
 */
async function contarFichas() {
    const filas = await db().ejecutarQuery(
        `SELECT COUNT(*) AS total FROM fichaClinica WHERE estadoFicha <> 0`, []
    );
    return Number(filas?.[0]?.total || 0);
}