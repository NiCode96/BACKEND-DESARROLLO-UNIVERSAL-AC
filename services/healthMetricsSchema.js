import DataBase from '../config/Database.js';

const db = () => DataBase.getInstance();

/**
 * Crea registro_accesos si no existe, al arrancar el backend.
 *
 * Por qué acá y no como migración manual: este mismo código corre en ~50 bases
 * de datos distintas, una por clínica. Ejecutar la migración cliente por
 * cliente es trabajo que se olvida, y un backend desplegado sin su tabla
 * devuelve 500 en /health-metrics sin que nadie se entere hasta que alguien
 * mira el health score. Creándola al arrancar, desplegar el código ES la
 * migración.
 *
 * Es seguro hacerlo así en este caso concreto:
 *   - CREATE TABLE IF NOT EXISTS es idempotente: arrancar mil veces no cambia
 *     nada después de la primera.
 *   - Es una tabla auxiliar de telemetría y auditoría, no toca el esquema del
 *     negocio (reservas, fichas, pacientes). No hay ALTER sobre datos vivos.
 *   - Si falla, se registra y el backend arranca igual: la app de la clínica
 *     nunca debe caerse por una tabla de métricas.
 *
 * Lo que NO hay que hacer acá: ALTER TABLE sobre tablas existentes ni nada que
 * modifique datos. Para eso siguen siendo migraciones revisadas a mano.
 */
export async function asegurarEsquemaHealthMetrics() {
    try {
        await db().ejecutarQuery(`
            CREATE TABLE IF NOT EXISTS registro_accesos (
                id_acceso        BIGINT       NOT NULL AUTO_INCREMENT,
                usuario_clerk_id VARCHAR(191) NULL,
                usuario_email    VARCHAR(255) NULL,
                usuario_nombre   VARCHAR(255) NULL,
                rol              VARCHAR(60)  NULL,
                id_profesional   INT          NULL,
                ip               VARCHAR(45)  NULL,
                user_agent       VARCHAR(255) NULL,
                ocurrido_en      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id_acceso),
                KEY idx_accesos_ocurrido_en (ocurrido_en),
                KEY idx_accesos_usuario (usuario_clerk_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `, []);
        console.log('[HEALTH METRICS] registro_accesos disponible');
    } catch (error) {
        // No relanzar: un fallo acá no debe impedir que la clínica trabaje.
        console.error('[HEALTH METRICS] No se pudo asegurar registro_accesos:', error.message);
    }
}
