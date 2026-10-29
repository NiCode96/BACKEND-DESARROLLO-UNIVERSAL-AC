-- Migración aditiva: previsión de salud y comentario de cada reserva.
-- Requerimiento del 28-10-2026 (panel financiero: distribución por previsión).
--
-- No modifica ni borra columnas existentes. Las reservas que ya existen quedan
-- con 'No indicado' en ambos campos gracias al DEFAULT, y los INSERT que no
-- mencionan las columnas (código antiguo o clientes que no las envían) también.
--
-- Antes de correr en el servidor: mysqldump de reservaPacientes como mínimo.

-- 1) Columnas nuevas
--    prevision: nombre del catálogo (FONASA, ISAPRE, CONVENIO, SIN PREVISION,
--               CAPREDENA, DIPRECA, PARTICULAR) o 'No indicado'. El backend rechaza cualquier
--               otro valor (services/camposReserva.js).
--    comentario: nota breve de la cita, máx. 100 caracteres (mismo límite del front).
ALTER TABLE reservaPacientes
    ADD COLUMN prevision  VARCHAR(20)  NOT NULL DEFAULT 'No indicado' COMMENT 'Previsión de salud al momento de reservar',
    ADD COLUMN comentario VARCHAR(100) NOT NULL DEFAULT 'No indicado' COMMENT 'Comentario breve de la cita';

-- 2) Índice para la estadística del panel financiero
--    (WHERE estadoPeticion = 1 AND fechaInicio BETWEEN ? AND ? GROUP BY prevision).
CREATE INDEX idx_reserva_peticion_fecha_prevision
    ON reservaPacientes (estadoPeticion, fechaInicio, prevision);

-- 3) Comprobación (debe mostrar las dos columnas y el índice)
-- SHOW COLUMNS FROM reservaPacientes LIKE 'prevision';
-- SHOW COLUMNS FROM reservaPacientes LIKE 'comentario';
-- SHOW INDEX FROM reservaPacientes WHERE Key_name = 'idx_reserva_peticion_fecha_prevision';

-- Reversión (solo si hiciera falta deshacer):
-- DROP INDEX idx_reserva_peticion_fecha_prevision ON reservaPacientes;
-- ALTER TABLE reservaPacientes DROP COLUMN comentario, DROP COLUMN prevision;
