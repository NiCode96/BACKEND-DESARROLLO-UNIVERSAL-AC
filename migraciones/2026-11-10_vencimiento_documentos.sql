-- ---------------------------------------------------------------------
-- Vencimiento de los documentos por firmar (docs/firma, bandeja)
--
-- Decidido con el centro (10-11-2026): a los 7 días se avisa al profesional que
-- tiene documentos esperando su firma; a los 30 días (24 h el consentimiento
-- informado, cuyo código ya caducó) el documento se anula solo y se borra su
-- borrador de R2. aviso_vencimiento_at evita avisar dos veces por el mismo documento.
--
-- Se puede correr más de una vez: la columna y el índice solo se crean si faltan.
-- ---------------------------------------------------------------------

SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documento_emitido' AND COLUMN_NAME = 'aviso_vencimiento_at');
SET @sql := IF(@existe = 0,
  'ALTER TABLE documento_emitido ADD COLUMN aviso_vencimiento_at DATETIME(3) NULL AFTER preparado_ip',
  'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @existe := (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documento_emitido' AND INDEX_NAME = 'idx_documento_pendientes');
SET @sql := IF(@existe = 0,
  'ALTER TABLE documento_emitido ADD INDEX idx_documento_pendientes (estado, preparado_at)',
  'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;
