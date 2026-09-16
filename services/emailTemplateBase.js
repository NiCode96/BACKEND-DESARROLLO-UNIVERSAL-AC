// Base visual compartida para todos los correos del backend.
// Diseño limpio tipo "producto": fondo blanco, tarjeta con borde simple (sin
// sombra, sin degradado, sin barra de color), un único color de acento
// (violeta #6E56CF, color primario de Agenda Clínica), sin logo.
// Se genera como HTML plano con estilos inline (requisito de compatibilidad
// con clientes de correo) — no usa Tailwind ni React porque este backend no
// renderiza vistas, solo arma el htmlContent que se manda a Brevo.

export const ACCENT = '#6E56CF';
export const TEXTO_PRINCIPAL = '#1c1c1e';
export const TEXTO_SECUNDARIO = '#6b7280';
export const BORDE = '#e5e5ea';
export const FONDO_SUAVE = '#f9fafb';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

function escaparHtml(texto = '') {
    return String(texto ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Fila de detalle (label / value) para usar dentro de construirTablaDetalle.
 */
export function construirFilaDetalle(label, value) {
    return `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BORDE}; color: ${TEXTO_SECUNDARIO}; font-size: 13px; width: 40%; vertical-align: top;">
          ${escaparHtml(label)}
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BORDE}; color: ${TEXTO_PRINCIPAL}; font-size: 14px; font-weight: 600; vertical-align: top;">
          ${value}
        </td>
      </tr>`;
}

/**
 * Tabla de detalle a partir de [{label, value}]. Omite filas sin value.
 */
export function construirTablaDetalle(filas = []) {
    const filasHtml = filas
        .filter((f) => f && f.value !== undefined && f.value !== null && f.value !== '')
        .map((f) => construirFilaDetalle(f.label, f.value))
        .join('');
    if (!filasHtml) return '';
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%; border-collapse: collapse;">${filasHtml}</table>`;
}

/**
 * Botón de acción: color sólido, sin degradado, esquinas redondeadas.
 */
export function construirBoton({ href, texto, color = ACCENT }) {
    if (!href) return '';
    return `<a href="${href}" style="display: inline-block; margin: 0 8px 8px 0; padding: 12px 22px; border-radius: 8px; background: ${color}; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600;">${escaparHtml(texto)}</a>`;
}

/**
 * Caja de aviso/nota (fondo suave, borde izquierdo de acento). Sin colores de alerta
 * llamativos — mantiene el tono neutro del resto del correo.
 */
export function construirAviso(texto, { color = ACCENT } = {}) {
    return `
      <div style="background: ${FONDO_SUAVE}; border-left: 3px solid ${color}; border-radius: 6px; padding: 14px 16px; margin: 20px 0;">
        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: ${TEXTO_PRINCIPAL};">${texto}</p>
      </div>`;
}

/**
 * Envoltorio base del correo. `contenidoHtml` es libre (tabla de detalle, botones,
 * avisos, texto) y se inserta dentro de la tarjeta con borde.
 *
 * @param {object} opts
 * @param {string} [opts.eyebrow]       Etiqueta pequeña en mayúsculas sobre el título (usa el color de acento)
 * @param {string} opts.titulo          Título principal (h1)
 * @param {string} [opts.introHtml]     Párrafo introductorio (antes de la tarjeta)
 * @param {string} opts.contenidoHtml   Contenido dentro de la tarjeta con borde
 * @param {string} [opts.footerNota]    Línea adicional en el footer, antes del copyright
 * @param {string} opts.nombreEmpresa
 */
export function construirCorreoBase({
    eyebrow,
    titulo,
    introHtml = '',
    contenidoHtml = '',
    footerNota = '',
    nombreEmpresa,
}) {
    const year = new Date().getFullYear();

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
</head>
<body style="margin:0; padding:0; background:#ffffff; font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
<tr><td align="center" style="padding: 40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%;">

  <tr><td style="padding-bottom: 24px;">
    ${eyebrow ? `<p style="margin:0 0 8px 0; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:${ACCENT};">${escaparHtml(eyebrow)}</p>` : ''}
    <h1 style="margin:0 0 12px 0; font-size:22px; font-weight:700; color:${TEXTO_PRINCIPAL}; line-height:1.3;">${escaparHtml(titulo)}</h1>
    ${introHtml ? `<div style="font-size:14px; line-height:1.7; color:${TEXTO_PRINCIPAL};">${introHtml}</div>` : ''}
  </td></tr>

  <tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDE}; border-radius:8px;">
      <tr><td style="padding: 24px;">
        ${contenidoHtml}
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding-top: 32px; text-align:center;">
    ${footerNota ? `<p style="margin:0 0 8px 0; font-size:12px; color:${TEXTO_SECUNDARIO};">${footerNota}</p>` : ''}
    <p style="margin:0; font-size:12px; color:${TEXTO_SECUNDARIO};">© ${year} ${escaparHtml(nombreEmpresa || '')}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Hora sin segundos: la base entrega "08:00:00" y en un correo basta "08:00".
 */
export function formatearHoraCorreo(hora) {
    const valor = String(hora ?? '').trim();
    if (!valor) return '-';

    const match = valor.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return valor;

    return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/**
 * RUT chileno con puntos y guion. El backend lo guarda sin formato ("152659873")
 * y asi se imprimia en los correos.
 */
export function formatearRutCorreo(rut) {
    const limpio = String(rut ?? '').replace(/[^0-9kK]/g, '').toUpperCase();
    if (limpio.length < 2) return String(rut ?? '').trim() || '-';

    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    const conPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return `${conPuntos}-${dv}`;
}
