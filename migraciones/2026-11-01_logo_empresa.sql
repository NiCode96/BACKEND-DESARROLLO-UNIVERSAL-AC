-- Migración aditiva: logo del centro / profesional (Fase B, 01-11-2026).
--
-- Guarda SOLO el id de Cloudflare Images (no la URL): el front arma la URL con
-- su hash de entrega, igual que portadas, publicaciones y fotos de profesionales.
-- La imagen llega ya recortada en cuadrado desde el dashboard (Datos de la
-- clínica → Logo) y la página pública la muestra en círculo antes del nombre.
--
-- NULL = sin logo: la página pública muestra solo el nombre.
-- La escribe POST /datosempresa/actualizarLogo (con sesión de Clerk).
-- La leen los dos SELECT * del modelo DatosEmpresa (no hay que tocarlos).

ALTER TABLE datos_empresa
    ADD COLUMN logoEmpresa VARCHAR(100) NULL DEFAULT NULL
        COMMENT 'Id de Cloudflare Images del logo (cuadrado, se muestra en círculo)'
        AFTER empresaNombre;

-- Comprobación:
-- SHOW COLUMNS FROM datos_empresa LIKE 'logoEmpresa';

-- Reversión (solo si hiciera falta deshacer):
-- ALTER TABLE datos_empresa DROP COLUMN logoEmpresa;
