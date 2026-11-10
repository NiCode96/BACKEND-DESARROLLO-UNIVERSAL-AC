/* Medidas del pie de firma FES, en milímetros.
 *
 * Compartidas entre el front (que RESERVA el espacio al generar el cuerpo del
 * documento) y el servidor (que ESTAMPA la firma ahí). Si se cambian aquí, hay
 * que cambiarlas igual en el backend (docs/firma/03 §5.6): una diferencia
 * haría que la firma se dibuje encima del contenido.
 */

export const ZONA_FIRMA = {
  alto: 56,
  anchoQr: 30,
  separacionQr: 6,
  altoGrafia: 18,
  anchoMaxGrafia: 70,
};

/** Alto que ocupa el pie manuscrito (sin grafía ni QR) dibujado con dibujarBloqueFirma. */
export const ALTO_FIRMA_MANUSCRITA = 46;

export const MODOS_FIRMA = { FES: "fes", MANUSCRITA: "manuscrita" };

/**
 * Zona de aceptación del paciente (consentimiento informado con OTP), en mm.
 * El servidor estampa ahí nombre, documento, canal y hora del código verificado.
 */
export const ZONA_PACIENTE = { alto: 26 };
