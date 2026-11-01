-- Migración aditiva: categoría de atención del profesional (Fase B.5, 01-11-2026).
--
-- Texto libre elegido en el dashboard (Profesionales → "Categoría de atención",
-- con sugerencias chilenas). La reserva pública agrupa a los profesionales por
-- esta columna y pregunta "¿Qué tipo de atención necesitas?" cuando hay 2 o más.
--
-- NULL = sin categoría (el profesional aparece en "ver todos").
-- La escriben insertarProfesional / actualizarProfesional (services/categoriaProfesional.js).
-- La leen los SELECT * de model/Profesionales.js (no hay que tocarlos).

ALTER TABLE profesionales
    ADD COLUMN categoriaProfesional VARCHAR(60) NULL DEFAULT NULL
        COMMENT 'Categoría de atención (Odontología, Psicología…); agrupa la reserva pública'
        AFTER descripcionProfesional,
    ADD INDEX idx_categoria_profesional (categoriaProfesional);

-- Comprobación:
-- SHOW COLUMNS FROM profesionales LIKE 'categoriaProfesional';

-- Reversión (solo si hiciera falta deshacer):
-- ALTER TABLE profesionales DROP INDEX idx_categoria_profesional, DROP COLUMN categoriaProfesional;
