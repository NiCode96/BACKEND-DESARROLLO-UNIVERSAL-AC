-- ---------------------------------------------------------------------
-- Código OTP del consentimiento informado por WhatsApp (docs/firma, Fase 7)
--
-- El paciente puede recibir el código por WhatsApp (plantilla de autenticación
-- aprobada por Meta, TWILIO_CONTENT_SID_OTP) además de por correo. La evidencia
-- debe decir el canal real, así que 'whatsapp' se agrega a los dos ENUM.
-- 'sms' se conserva: lo usan filas existentes y sigue disponible si se configura
-- TWILIO_SMS_FROM.
--
-- MODIFY con la lista completa: se puede correr más de una vez sin error.
-- ---------------------------------------------------------------------

ALTER TABLE paciente_otp
  MODIFY COLUMN canal ENUM('email','sms','whatsapp') NOT NULL;

ALTER TABLE documento_emitido
  MODIFY COLUMN paciente_canal ENUM('email','sms','whatsapp') NULL;
