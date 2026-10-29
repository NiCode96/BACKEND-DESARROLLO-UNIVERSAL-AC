-- Migración aditiva: columna que el código usa desde el 19-08-2026
-- (commits 58bf360 y 16fa2a4, expiración de pagos pendientes a los 10 minutos)
-- pero que nunca se creó en la base de desarrollo.
--
-- Sin ella:
--   - POST /pagosMercadoPago/create-order no puede crear la reserva pendiente
--     (INSERT ... fechaExpiracionPago → "Unknown column"), y
--   - el cron de app.js falla cada minuto (expirarReservasPendientes).
--
-- La llena insertarReservaPacienteBackend (ahora + 10 minutos) y la lee el cron:
--   UPDATE ... SET estadoPeticion = 0 WHERE fechaExpiracionPago <= NOW() AND estadoPeticion = 3
-- Node y MySQL deben compartir zona horaria (en el servidor ambos están en UTC).
--
-- Las reservas existentes quedan en NULL: no son pagos en curso y el cron no las toca.

ALTER TABLE reservaPacientes
    ADD COLUMN fechaExpiracionPago DATETIME NULL COMMENT 'Vencimiento del pago en curso (estadoPeticion = 3)';

-- Comprobación:
-- SHOW COLUMNS FROM reservaPacientes LIKE 'fechaExpiracionPago';

-- Reversión (solo si hiciera falta deshacer):
-- ALTER TABLE reservaPacientes DROP COLUMN fechaExpiracionPago;
