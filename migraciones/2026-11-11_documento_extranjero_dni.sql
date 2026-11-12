-- ---------------------------------------------------------------------
-- Documento de pacientes extranjeros: se agrega el DNI junto al pasaporte
--
-- Pedido del centro (11-11-2026): un paciente extranjero se identifica con
-- pasaporte o con DNI (cédula de su país). El tipo queda guardado para que la
-- ficha, los PDF y la constancia de consentimiento digan el documento correcto.
-- Mismas columnas de docs/firma (2026-10-23_firma_electronica.sql); solo se amplía el ENUM.
--
-- Se puede correr más de una vez: MODIFY con la misma definición no cambia nada,
-- y cada tabla solo se toca si la columna existe.
-- ---------------------------------------------------------------------

SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pacienteDatos' AND COLUMN_NAME = 'tipo_documento');
SET @sql := IF(@existe = 1,
  "ALTER TABLE pacienteDatos MODIFY COLUMN tipo_documento ENUM('rut','pasaporte','dni') NOT NULL DEFAULT 'rut'",
  'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservaPacientes' AND COLUMN_NAME = 'tipo_documento');
SET @sql := IF(@existe = 1,
  "ALTER TABLE reservaPacientes MODIFY COLUMN tipo_documento ENUM('rut','pasaporte','dni') NOT NULL DEFAULT 'rut'",
  'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'consentimiento_aceptacion' AND COLUMN_NAME = 'paciente_tipo_documento');
SET @sql := IF(@existe = 1,
  "ALTER TABLE consentimiento_aceptacion MODIFY COLUMN paciente_tipo_documento ENUM('rut','pasaporte','dni') NOT NULL",
  'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;
