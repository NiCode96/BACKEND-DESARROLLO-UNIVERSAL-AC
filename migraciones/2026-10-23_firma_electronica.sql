-- =====================================================================
-- Firma Electrónica Simple (FES) — Ley 19.799
-- Migración aditiva · MySQL 8.0.16+ (CHECK y defaults por expresión)
-- Todos los *_at en UTC, DATETIME(3).
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 3.1 Usuarios de la plataforma (mapeo local de Clerk)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario_plataforma (
  id_usuario        BINARY(16)   NOT NULL,
  clerk_user_id     VARCHAR(191) NOT NULL,
  id_profesional    INT          NULL,
  nombre            VARCHAR(255) NULL,
  email             VARCHAR(255) NULL,
  rol               VARCHAR(60)  NULL,
  creado_at         DATETIME(3)  NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  actualizado_at    DATETIME(3)  NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uq_usuario_clerk (clerk_user_id),
  KEY idx_usuario_profesional (id_profesional),
  CONSTRAINT fk_usuario_profesional FOREIGN KEY (id_profesional)
    REFERENCES profesionales (id_profesional)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------
-- 3.2 Profesionales: registro Superintendencia de Salud (RNPI)
-- ---------------------------------------------------------------------
ALTER TABLE profesionales
  ADD COLUMN registro_sis_numero            VARCHAR(10)  NULL AFTER rutProfesional,
  ADD COLUMN registro_sis_estado            ENUM('no_informado','declarado','verificado','rechazado')
                                            NOT NULL DEFAULT 'no_informado' AFTER registro_sis_numero,
  ADD COLUMN registro_sis_certificado_key   VARCHAR(500) NULL AFTER registro_sis_estado,
  ADD COLUMN registro_sis_certificado_mime  VARCHAR(50)  NULL AFTER registro_sis_certificado_key,
  ADD COLUMN registro_sis_certificado_sha256 CHAR(64)    NULL AFTER registro_sis_certificado_mime,
  ADD COLUMN registro_sis_verificado_por    BINARY(16)   NULL AFTER registro_sis_certificado_sha256,
  ADD COLUMN registro_sis_verificado_at     DATETIME(3)  NULL AFTER registro_sis_verificado_por,
  ADD COLUMN registro_sis_motivo_rechazo    VARCHAR(500) NULL AFTER registro_sis_verificado_at,
  ADD CONSTRAINT chk_registro_sis_numero CHECK (registro_sis_numero IS NULL OR registro_sis_numero REGEXP '^[0-9]{1,10}$'),
  ADD CONSTRAINT fk_registro_sis_verificador FOREIGN KEY (registro_sis_verificado_por)
    REFERENCES usuario_plataforma (id_usuario);

-- ---------------------------------------------------------------------
-- 3.3 Pacientes y reservas: documento extranjero
-- ---------------------------------------------------------------------
ALTER TABLE pacienteDatos
  ADD COLUMN tipo_documento ENUM('rut','pasaporte') NOT NULL DEFAULT 'rut' AFTER rut;

ALTER TABLE reservaPacientes
  ADD COLUMN tipo_documento ENUM('rut','pasaporte') NOT NULL DEFAULT 'rut' AFTER rut;

-- ---------------------------------------------------------------------
-- 3.4 Plantillas versionadas (acta FES, consentimientos, anexos)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documento_plantilla (
  id_plantilla      BINARY(16)   NOT NULL,
  codigo            VARCHAR(80)  NOT NULL,           -- acta_adhesion_fes | tratamiento_datos | derechos_deberes_paciente | consentimiento_base | anexo_<procedimiento>
  categoria         ENUM('acta_fes','consentimiento_publico','consentimiento_base','anexo_procedimiento') NOT NULL,
  version           INT UNSIGNED NOT NULL,
  titulo            VARCHAR(255) NOT NULL,
  cuerpo            MEDIUMTEXT   NOT NULL,           -- texto sin interpolar
  cuerpo_sha256     CHAR(64)     NOT NULL,           -- SHA2(cuerpo,256), utf8mb4
  estado            ENUM('borrador','vigente','retirada') NOT NULL DEFAULT 'borrador',
  vigente_desde     DATETIME(3)  NULL,
  retirada_at       DATETIME(3)  NULL,
  creado_por_clerk  VARCHAR(191) NULL,
  creado_at         DATETIME(3)  NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  -- una sola versión vigente por código
  vigente_unica     VARCHAR(80)  GENERATED ALWAYS AS (IF(estado = 'vigente', codigo, NULL)) STORED,
  PRIMARY KEY (id_plantilla),
  UNIQUE KEY uq_plantilla_codigo_version (codigo, version),
  UNIQUE KEY uq_plantilla_vigente (vigente_unica),
  KEY idx_plantilla_categoria (categoria, estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------
-- 3.5 Firma (grafía) del profesional
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profesional_firma (
  id_firma          BINARY(16)   NOT NULL,
  id_profesional    INT          NOT NULL,
  estado            ENUM('activa','reemplazada','revocada') NOT NULL DEFAULT 'activa',
  origen            ENUM('propia') NOT NULL DEFAULT 'propia',   -- solo el profesional captura su firma
  tinta             ENUM('azul','negro') NOT NULL,
  imagen_key        VARCHAR(500) NOT NULL,           -- R2 privado, clave aleatoria
  imagen_sha256     CHAR(64)     NOT NULL,           -- del PNG normalizado
  imagen_mime       VARCHAR(30)  NOT NULL DEFAULT 'image/png',
  ancho_px          SMALLINT UNSIGNED NOT NULL,
  alto_px           SMALLINT UNSIGNED NOT NULL,
  trazos_key        VARCHAR(500) NOT NULL,           -- JSON de vectores en R2
  trazos_sha256     CHAR(64)     NOT NULL,
  id_plantilla_acta BINARY(16)   NOT NULL,           -- versión exacta del acta aceptada
  acta_sha256       CHAR(64)     NOT NULL,
  acta_aceptada_at  DATETIME(3)  NOT NULL,
  id_usuario        BINARY(16)   NOT NULL,           -- quién la registró (debe ser el propio profesional)
  clerk_user_id     VARCHAR(191) NOT NULL,           -- denormalizado
  ip                VARCHAR(45)  NULL,
  user_agent        VARCHAR(255) NULL,
  registrada_at     DATETIME(3)  NOT NULL,
  cerrada_at        DATETIME(3)  NULL,               -- cuando pasa a reemplazada/revocada
  motivo_cierre     VARCHAR(255) NULL,
  -- equivalente MySQL del índice parcial único: una firma activa por profesional
  activa_de         INT GENERATED ALWAYS AS (IF(estado = 'activa', id_profesional, NULL)) STORED,
  PRIMARY KEY (id_firma),
  UNIQUE KEY uq_firma_activa_por_profesional (activa_de),
  KEY idx_firma_profesional (id_profesional, registrada_at),
  CONSTRAINT chk_firma_cierre CHECK ((estado = 'activa' AND cerrada_at IS NULL) OR (estado <> 'activa' AND cerrada_at IS NOT NULL)),
  CONSTRAINT chk_firma_dimensiones CHECK (alto_px BETWEEN 20 AND 200 AND ancho_px BETWEEN 20 AND 600),
  CONSTRAINT fk_firma_profesional FOREIGN KEY (id_profesional) REFERENCES profesionales (id_profesional),
  CONSTRAINT fk_firma_usuario     FOREIGN KEY (id_usuario)     REFERENCES usuario_plataforma (id_usuario),
  CONSTRAINT fk_firma_acta        FOREIGN KEY (id_plantilla_acta) REFERENCES documento_plantilla (id_plantilla)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------
-- 3.6 Documentos emitidos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documento_emitido (
  id_documento            BINARY(16)   NOT NULL,
  codigo_verificacion     CHAR(9)      NOT NULL,     -- 'A7K2-9QX4'
  tipo_documento          ENUM('cotizacion','presupuesto','orden_examen','ficha_clinica',
                               'consentimiento_informado','indicaciones','certificado_atencion') NOT NULL, -- sin receta: requiere FEA
  titulo                  VARCHAR(255) NOT NULL,
  estado                  ENUM('pendiente_firma','firmado','anulado') NOT NULL DEFAULT 'pendiente_firma',
  referencia_tabla        VARCHAR(60)  NULL,
  referencia_id           INT          NULL,
  id_paciente             INT          NULL,
  id_profesional_firmante INT          NOT NULL,

  -- snapshot (lo que se firmó, independiente de cambios futuros en plantillas)
  metadatos_json          JSON         NOT NULL,     -- {plantillas:[{codigo,version,sha256}], resumen, texto_renderizado?}
  zona_firma_json         JSON         NOT NULL,     -- {pagina,x,y,ancho,alto} en mm
  zona_paciente_json      JSON         NULL,         -- solo consentimiento: zona de la aceptación por OTP

  -- aceptación del paciente por código (consentimiento informado)
  paciente_otp_id         BINARY(16)   NULL,
  paciente_acepto_at      DATETIME(3)  NULL,
  paciente_canal          ENUM('email','sms') NULL,
  paciente_destino        VARCHAR(100) NULL,         -- enmascarado, tal como se estampa
  paciente_firmante       VARCHAR(255) NULL,         -- paciente o representante legal

  -- borrador (cuerpo enviado por el front)
  borrador_key            VARCHAR(500) NOT NULL,
  borrador_sha256         CHAR(64)     NOT NULL,
  borrador_bytes          INT UNSIGNED NOT NULL,
  paginas                 SMALLINT UNSIGNED NOT NULL,

  -- generación (operador autenticado en Clerk)
  preparado_por_usuario   BINARY(16)   NOT NULL,
  preparado_por_clerk_id  VARCHAR(191) NOT NULL,
  preparado_por_nombre    VARCHAR(255) NULL,
  preparado_at            DATETIME(3)  NOT NULL,
  preparado_ip            VARCHAR(45)  NULL,

  -- firma (profesional firmante, distinto campo que el operador)
  id_firma                BINARY(16)   NULL,
  firmado_por_usuario     BINARY(16)   NULL,
  firmado_por_clerk_id    VARCHAR(191) NULL,
  firmado_at              DATETIME(3)  NULL,
  pdf_key                 VARCHAR(500) NULL,
  pdf_sha256              CHAR(64)     NULL,
  pdf_bytes               INT UNSIGNED NULL,

  -- anulación
  anulado_por_usuario     BINARY(16)   NULL,
  anulado_at              DATETIME(3)  NULL,
  motivo_anulacion        VARCHAR(500) NULL,

  PRIMARY KEY (id_documento),
  UNIQUE KEY uq_documento_codigo (codigo_verificacion),
  KEY idx_documento_paciente (id_paciente, preparado_at),
  KEY idx_documento_firmante_estado (id_profesional_firmante, estado),
  KEY idx_documento_referencia (referencia_tabla, referencia_id),
  CONSTRAINT chk_documento_firmado CHECK (
    estado = 'pendiente_firma'
    OR (estado = 'firmado' AND firmado_at IS NOT NULL AND pdf_sha256 IS NOT NULL AND pdf_key IS NOT NULL AND id_firma IS NOT NULL)
    OR (estado = 'anulado' AND anulado_at IS NOT NULL)
  ),
  CONSTRAINT chk_documento_aceptacion CHECK (
    zona_paciente_json IS NULL OR estado <> 'firmado' OR paciente_acepto_at IS NOT NULL
  ),
  CONSTRAINT chk_documento_codigo CHECK (codigo_verificacion REGEXP '^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$'),
  CONSTRAINT fk_documento_paciente    FOREIGN KEY (id_paciente) REFERENCES pacienteDatos (id_paciente),
  CONSTRAINT fk_documento_firmante    FOREIGN KEY (id_profesional_firmante) REFERENCES profesionales (id_profesional),
  CONSTRAINT fk_documento_firma       FOREIGN KEY (id_firma) REFERENCES profesional_firma (id_firma),
  CONSTRAINT fk_documento_preparador  FOREIGN KEY (preparado_por_usuario) REFERENCES usuario_plataforma (id_usuario),
  CONSTRAINT fk_documento_firmador    FOREIGN KEY (firmado_por_usuario) REFERENCES usuario_plataforma (id_usuario),
  CONSTRAINT fk_documento_anulador    FOREIGN KEY (anulado_por_usuario) REFERENCES usuario_plataforma (id_usuario)
  -- paciente_otp_id no lleva FOREIGN KEY: paciente_otp referencia a documento_emitido
  -- (dependencia circular); se valida en la aplicación.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------
-- 3.7 Consentimientos aceptados en la reserva pública
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consentimiento_aceptacion (
  id_aceptacion           BINARY(16)   NOT NULL,
  token_aceptacion        CHAR(35)     NOT NULL,     -- 'ca_' + 32 hex, para vincular la reserva
  codigo_verificacion     CHAR(9)      NOT NULL,
  id_plantilla            BINARY(16)   NOT NULL,
  plantilla_codigo        VARCHAR(80)  NOT NULL,
  plantilla_version       INT UNSIGNED NOT NULL,
  plantilla_sha256        CHAR(64)     NOT NULL,
  texto_renderizado       MEDIUMTEXT   NOT NULL,     -- snapshot interpolado que vio el paciente
  texto_sha256            CHAR(64)     NOT NULL,
  id_profesional          INT          NULL,
  id_reserva              INT          NULL,
  id_paciente             INT          NULL,
  paciente_nombre         VARCHAR(255) NOT NULL,
  paciente_apellido       VARCHAR(255) NOT NULL,
  paciente_tipo_documento ENUM('rut','pasaporte') NOT NULL,
  paciente_documento      VARCHAR(20)  NOT NULL,
  paciente_correo         VARCHAR(255) NOT NULL,
  paciente_telefono       VARCHAR(30)  NULL,
  origen                  ENUM('web','dashboard') NOT NULL DEFAULT 'web',
  aceptado_at             DATETIME(3)  NOT NULL,
  ip                      VARCHAR(45)  NULL,
  user_agent              VARCHAR(255) NULL,
  pdf_key                 VARCHAR(500) NOT NULL,     -- constancia generada UNA vez
  pdf_sha256              CHAR(64)     NOT NULL,
  vinculado_at            DATETIME(3)  NULL,
  revocado_at             DATETIME(3)  NULL,
  revocado_por_usuario    BINARY(16)   NULL,
  motivo_revocacion       VARCHAR(500) NULL,
  PRIMARY KEY (id_aceptacion),
  UNIQUE KEY uq_aceptacion_codigo (codigo_verificacion),
  KEY idx_aceptacion_token (token_aceptacion),
  KEY idx_aceptacion_paciente (id_paciente, aceptado_at),
  KEY idx_aceptacion_documento (paciente_documento),
  KEY idx_aceptacion_reserva (id_reserva),
  CONSTRAINT fk_aceptacion_plantilla   FOREIGN KEY (id_plantilla) REFERENCES documento_plantilla (id_plantilla),
  CONSTRAINT fk_aceptacion_paciente    FOREIGN KEY (id_paciente)  REFERENCES pacienteDatos (id_paciente),
  CONSTRAINT fk_aceptacion_profesional FOREIGN KEY (id_profesional) REFERENCES profesionales (id_profesional),
  CONSTRAINT fk_aceptacion_revocador   FOREIGN KEY (revocado_por_usuario) REFERENCES usuario_plataforma (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
-- Nota: un mismo token agrupa las dos aceptaciones (datos + general) de una reserva.

-- ---------------------------------------------------------------------
-- 3.8 OTP del paciente (modelado ahora; implementación posterior)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paciente_otp (
  id_otp            BINARY(16)   NOT NULL,
  id_documento      BINARY(16)   NOT NULL,
  id_paciente       INT          NOT NULL,
  canal             ENUM('email','sms') NOT NULL,
  destino_mascarado VARCHAR(100) NOT NULL,
  codigo_hash       CHAR(64)     NOT NULL,           -- HMAC-SHA256(clave, codigo + id_otp); nunca el código
  intentos          TINYINT UNSIGNED NOT NULL DEFAULT 0,
  creado_at         DATETIME(3)  NOT NULL,
  expira_at         DATETIME(3)  NOT NULL,
  verificado_at     DATETIME(3)  NULL,
  ip_verificacion   VARCHAR(45)  NULL,
  PRIMARY KEY (id_otp),
  KEY idx_otp_documento (id_documento, creado_at),
  CONSTRAINT chk_otp_intentos CHECK (intentos <= 5),
  CONSTRAINT fk_otp_documento FOREIGN KEY (id_documento) REFERENCES documento_emitido (id_documento),
  CONSTRAINT fk_otp_paciente  FOREIGN KEY (id_paciente)  REFERENCES pacienteDatos (id_paciente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------
-- 3.9 Bitácora de accesos a documentos (append-only, sin cadena)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documento_acceso (
  id_acceso         BINARY(16)   NOT NULL,
  id_documento      BINARY(16)   NULL,
  id_aceptacion     BINARY(16)   NULL,
  accion            ENUM('generado','visto','descargado','impreso','enviado','verificado_publico','impreso_manuscrito') NOT NULL,
  actor_usuario     BINARY(16)   NULL,               -- NULL en accesos públicos
  actor_clerk_id    VARCHAR(191) NULL,               -- denormalizado: sobrevive al borrado en Clerk
  actor_nombre      VARCHAR(255) NULL,
  actor_rol         VARCHAR(60)  NULL,
  destinatario      VARCHAR(255) NULL,               -- solo para 'enviado'
  ip                VARCHAR(45)  NULL,
  user_agent        VARCHAR(255) NULL,
  ocurrido_at       DATETIME(3)  NOT NULL,
  PRIMARY KEY (id_acceso),
  KEY idx_acceso_documento (id_documento, ocurrido_at),
  KEY idx_acceso_aceptacion (id_aceptacion, ocurrido_at),
  KEY idx_acceso_actor (actor_clerk_id, ocurrido_at),
  CONSTRAINT chk_acceso_objetivo CHECK (id_documento IS NOT NULL OR id_aceptacion IS NOT NULL OR accion = 'impreso_manuscrito'),
  CONSTRAINT fk_acceso_documento  FOREIGN KEY (id_documento)  REFERENCES documento_emitido (id_documento),
  CONSTRAINT fk_acceso_aceptacion FOREIGN KEY (id_aceptacion) REFERENCES consentimiento_aceptacion (id_aceptacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------
-- 3.10 Evidencia de firma (append-only, encadenada y sellada)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS firma_cadena_estado (
  id                TINYINT UNSIGNED NOT NULL,       -- siempre 1: fila de control para serializar
  ultima_secuencia  BIGINT UNSIGNED  NOT NULL,
  ultimo_hash       CHAR(64)         NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT chk_cadena_unica CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO firma_cadena_estado (id, ultima_secuencia, ultimo_hash)
VALUES (1, 0, REPEAT('0', 64));

CREATE TABLE IF NOT EXISTS firma_evento (
  id_evento            BINARY(16)      NOT NULL,
  secuencia            BIGINT UNSIGNED NOT NULL,
  tipo_evento          ENUM('acta_aceptada','firma_registrada','firma_reemplazada','firma_revocada',
                            'documento_firmado','documento_anulado',
                            'registro_sis_declarado','registro_sis_verificado','registro_sis_rechazado',
                            'consentimiento_aceptado','consentimiento_revocado',
                            'otp_paciente_verificado') NOT NULL,
  id_documento         BINARY(16)      NULL,
  id_firma             BINARY(16)      NULL,
  id_aceptacion        BINARY(16)      NULL,
  id_profesional       INT             NULL,
  id_paciente          INT             NULL,
  actor_tipo           ENUM('profesional','operador','paciente','sistema') NOT NULL,
  actor_usuario        BINARY(16)      NULL,
  actor_clerk_id       VARCHAR(191)    NULL,         -- denormalizado
  actor_nombre         VARCHAR(255)    NULL,
  metodo_autenticacion VARCHAR(60)     NOT NULL,     -- clerk_reverificacion_primer_factor | clerk_reverificacion_segundo_factor | clerk_sesion | otp_email | otp_sms | formulario_publico
  autenticado_at       DATETIME(3)     NULL,
  documento_sha256     CHAR(64)        NULL,
  datos_json           JSON            NOT NULL,     -- detalle del evento (versión de acta, motivo, etc.)
  ip                   VARCHAR(45)     NULL,
  user_agent           VARCHAR(255)    NULL,
  ocurrido_at          DATETIME(3)     NOT NULL,
  hash_anterior        CHAR(64)        NOT NULL,
  hash_evento          CHAR(64)        NOT NULL,     -- SHA-256(canónico)
  sello_hmac           CHAR(64)        NOT NULL,     -- HMAC-SHA256(FIRMA_HMAC_CLAVE, hash_evento)
  clave_version        TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (id_evento),
  UNIQUE KEY uq_evento_secuencia (secuencia),
  UNIQUE KEY uq_evento_hash (hash_evento),
  KEY idx_evento_documento (id_documento),
  KEY idx_evento_firma (id_firma),
  KEY idx_evento_profesional (id_profesional, ocurrido_at),
  KEY idx_evento_aceptacion (id_aceptacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
-- Sin FOREIGN KEY a propósito: la evidencia debe sobrevivir aunque se depuren
-- otras tablas. Los IDs se validan en la aplicación al insertar.

-- Append-only por trigger (aplica a TODOS los usuarios de MySQL, incluido root vía app)
CREATE TRIGGER trg_firma_evento_sin_update BEFORE UPDATE ON firma_evento
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'firma_evento es append-only';

CREATE TRIGGER trg_firma_evento_sin_delete BEFORE DELETE ON firma_evento
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'firma_evento es append-only';

CREATE TRIGGER trg_documento_acceso_sin_update BEFORE UPDATE ON documento_acceso
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'documento_acceso es append-only';

CREATE TRIGGER trg_documento_acceso_sin_delete BEFORE DELETE ON documento_acceso
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'documento_acceso es append-only';

CREATE TRIGGER trg_documento_emitido_sin_delete BEFORE DELETE ON documento_emitido
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'documento_emitido no se elimina; usar anulado';

-- Un documento firmado no cambia de contenido: solo puede pasar a 'anulado'.
-- Lleva punto y coma interno: requiere DELIMITER (en phpMyAdmin, poner "$$" en el
-- campo "Delimitador" de la pestaña SQL y quitar las líneas DELIMITER).
DELIMITER $$
CREATE TRIGGER trg_documento_firmado_inmutable BEFORE UPDATE ON documento_emitido
FOR EACH ROW
BEGIN
  IF OLD.estado IN ('firmado','anulado') AND (
       NOT (NEW.pdf_sha256 <=> OLD.pdf_sha256) OR NOT (NEW.pdf_key <=> OLD.pdf_key)
    OR NOT (NEW.firmado_at <=> OLD.firmado_at) OR NOT (NEW.id_firma <=> OLD.id_firma)
    OR NOT (NEW.borrador_sha256 <=> OLD.borrador_sha256)
    OR (OLD.estado = 'anulado' AND NEW.estado <> 'anulado')
    OR (OLD.estado = 'firmado' AND NEW.estado NOT IN ('firmado','anulado'))
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'documento firmado inmutable';
  END IF;
END$$
DELIMITER ;
