/* Estampa el pie de firma FES sobre el borrador de un documento.
 *
 * En producción esto corre SOLO en el servidor (docs/firma/03 §5.6): es el
 * único lugar donde la grafía entra al PDF, se ejecuta una vez por documento y
 * el SHA-256 se calcula sobre lo que devuelve. En el front lo usa únicamente el
 * modo mock, para ver el resultado final antes de que exista el backend.
 *
 * Isomórfico a propósito: recibe y devuelve bytes, y todo lo que depende del
 * entorno (QR, fecha formateada) llega ya resuelto. El backend puede copiar
 * este archivo sin tocarlo.
 *
 *   ┌──────────────────────────────────────────────────┬────────┐
 *   │            [grafía, 18 mm de alto]               │ ┌────┐ │
 *   │ ───────────────────────────────────              │ │ QR │ │
 *   │ Nombre del profesional              (10 pt bold) │ └────┘ │
 *   │ Profesión                                 (9 pt) │ CÓDIGO │
 *   │ RUT … · Reg. Superintendencia de Salud N° …      │        │
 *   │ Firmado electrónicamente · FES, Ley 19.799 (8 pt)│        │
 *   │ 22-10-2026 22:25:57 (UTC-03:00) · Código …       │        │
 *   │ Resumen del documento                     (8 pt) │        │
 *   └──────────────────────────────────────────────────┴────────┘
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { ZONA_FIRMA } from "./zonaFirma.js";

const MM = 72 / 25.4;
// Misma paleta que motorDocumento.js (PALETA.negro, .medio, .borde).
const TINTA = rgb(29 / 255, 29 / 255, 31 / 255);
const SECUNDARIO = rgb(110 / 255, 110 / 255, 115 / 255);
const FILETE = rgb(222 / 255, 222 / 255, 227 / 255);

// Helvetica estándar codifica en WinAnsi: tildes, ñ, ° y · sí; emojis o
// comillas tipográficas raras harían fallar drawText.
function sanear(texto) {
  return String(texto ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    // Se conserva • (U+2022, de los datos enmascarados): WinAnsi también lo codifica.
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u2022]/g, "")
    .trim();
}

// Recorta con "…" para que una línea nunca invada la columna del QR.
function ajustar(texto, fuente, tamano, anchoMax) {
  let t = sanear(texto);
  if (fuente.widthOfTextAtSize(t, tamano) <= anchoMax) return t;
  while (t.length > 1 && fuente.widthOfTextAtSize(`${t}...`, tamano) > anchoMax) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

/**
 * @param {object} p
 * @param {Uint8Array|ArrayBuffer} p.borrador   PDF generado por el front, con la zona vacía
 * @param {{pagina:number,x:number,y:number,ancho:number,alto:number}} p.zona  mm, y desde arriba
 * @param {Uint8Array|ArrayBuffer} p.grafiaPng  firma normalizada (PNG con alfa)
 * @param {Uint8Array|ArrayBuffer} p.qrPng      QR que apunta a la verificación pública
 * @param {{nombre:string, rut?:string, profesion?:string, registroSis?:string}} p.firmante
 * @param {string} p.textoFecha  "22-10-2026 22:25:57 (UTC-03:00)", ya formateado en America/Santiago
 * @param {Date}   p.firmadoAt   instante del servidor (metadato del PDF)
 * @param {string} p.codigo      "A7K2-9QX4"
 * @param {string} [p.resumen]   última línea, p. ej. "Consentimiento v3 · plantilla base + anexo"
 * @param {string} [p.titulo]
 * @param {{pagina,x,y,ancho,alto}} [p.zonaPaciente]  zona reservada para la aceptación del paciente (mm)
 * @param {{nombre:string, documento?:string, canal:"email"|"sms"|"whatsapp", destino:string, textoFecha:string}} [p.aceptacionPaciente]
 *        aceptación por código (OTP) ya verificada por el servidor
 * @returns {Promise<Uint8Array>}
 */
export async function estamparFirma({ borrador, zona, grafiaPng, qrPng, firmante, textoFecha, firmadoAt, codigo, resumen, titulo, zonaPaciente, aceptacionPaciente }) {
  const pdf = await PDFDocument.load(borrador, { updateMetadata: false });
  const pagina = pdf.getPage(zona.pagina - 1);
  const { height: altoPagina } = pagina.getSize();
  const yPdf = (mm) => altoPagina - mm * MM; // pdf-lib mide desde abajo

  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const grafia = await pdf.embedPng(grafiaPng);
  const qr = await pdf.embedPng(qrPng);

  const anchoTexto = (zona.ancho - ZONA_FIRMA.anchoQr - ZONA_FIRMA.separacionQr) * MM;
  const x = zona.x * MM;

  // 1) Grafía apoyada sobre la línea
  const altoGrafia = ZONA_FIRMA.altoGrafia * MM;
  const escala = Math.min(altoGrafia / grafia.height, (ZONA_FIRMA.anchoMaxGrafia * MM) / grafia.width);
  const yLinea = yPdf(zona.y + ZONA_FIRMA.altoGrafia + 2);
  pagina.drawImage(grafia, {
    x: x + 4,
    y: yLinea + 1,
    width: grafia.width * escala,
    height: grafia.height * escala,
  });

  // 2) Línea de firma
  pagina.drawLine({
    start: { x, y: yLinea },
    end: { x: x + Math.min(anchoTexto, 120 * MM), y: yLinea },
    thickness: 0.6,
    color: TINTA,
  });

  // 3) Líneas de texto (las vacías se omiten sin dejar hueco)
  const lineas = [
    { texto: firmante.nombre, fuente: negrita, tamano: 10, color: TINTA },
    { texto: firmante.profesion, fuente, tamano: 9, color: TINTA },
    {
      texto: [firmante.rut ? `RUT ${firmante.rut}` : "", firmante.registroSis ? `Reg. Superintendencia de Salud N° ${firmante.registroSis}` : ""].filter(Boolean).join(" · "),
      fuente, tamano: 8.5, color: TINTA,
    },
    { texto: "Firmado electrónicamente · FES, Ley 19.799", fuente, tamano: 8, color: SECUNDARIO },
    { texto: `${textoFecha} · Código ${codigo}`, fuente, tamano: 8, color: SECUNDARIO },
    { texto: resumen, fuente, tamano: 8, color: SECUNDARIO },
  ].filter((l) => sanear(l.texto));

  let cursor = yLinea - 13;
  for (const l of lineas) {
    pagina.drawText(ajustar(l.texto, l.fuente, l.tamano, anchoTexto), {
      x, y: cursor, size: l.tamano, font: l.fuente, color: l.color,
    });
    cursor -= l.tamano + 4.2;
  }
  if (cursor < yPdf(zona.y + zona.alto)) throw new Error("pdfInvalido");

  // 4) QR a la derecha, centrado verticalmente en la zona, con el código debajo
  const ladoQr = ZONA_FIRMA.anchoQr * MM;
  const xQr = (zona.x + zona.ancho - ZONA_FIRMA.anchoQr) * MM;
  const yQr = yPdf(zona.y + (zona.alto - ZONA_FIRMA.anchoQr) / 2) - ladoQr;
  pagina.drawRectangle({
    x: xQr - 2, y: yQr - 2, width: ladoQr + 4, height: ladoQr + 4,
    borderColor: FILETE, borderWidth: 0.6,
  });
  pagina.drawImage(qr, { x: xQr, y: yQr, width: ladoQr, height: ladoQr });
  const anchoCodigo = fuente.widthOfTextAtSize(codigo, 7);
  pagina.drawText(codigo, {
    x: xQr + (ladoQr - anchoCodigo) / 2, y: yQr - 11, size: 7, font: fuente, color: SECUNDARIO,
  });

  // 5) Aceptación del paciente por código (OTP), si el documento la requiere
  if (zonaPaciente && aceptacionPaciente) {
    const paginaPaciente = pdf.getPage(zonaPaciente.pagina - 1);
    const altoP = paginaPaciente.getSize().height;
    const xP = zonaPaciente.x * MM;
    const anchoP = zonaPaciente.ancho * MM;
    const yTope = altoP - zonaPaciente.y * MM;
    paginaPaciente.drawRectangle({
      x: xP, y: yTope - zonaPaciente.alto * MM, width: anchoP, height: zonaPaciente.alto * MM,
      color: rgb(244 / 255, 244 / 255, 247 / 255), borderColor: FILETE, borderWidth: 0.6,
    });
    const canal = { whatsapp: "WhatsApp", sms: "SMS" }[aceptacionPaciente.canal] || "correo electrónico";
    const lineasP = [
      { texto: "Aceptado electrónicamente por el paciente", fuente, tamano: 7.5, color: SECUNDARIO },
      { texto: [aceptacionPaciente.nombre, aceptacionPaciente.documento].filter(Boolean).join(" · "), fuente: negrita, tamano: 9.5, color: TINTA },
      { texto: `Código de verificación enviado por ${canal} a ${aceptacionPaciente.destino}`, fuente, tamano: 8, color: TINTA },
      { texto: `Verificado el ${aceptacionPaciente.textoFecha} · Ley 19.799`, fuente, tamano: 8, color: SECUNDARIO },
    ];
    let cursorP = yTope - 13;
    for (const l of lineasP) {
      paginaPaciente.drawText(ajustar(l.texto, l.fuente, l.tamano, anchoP - 16), { x: xP + 8, y: cursorP, size: l.tamano, font: l.fuente, color: l.color });
      cursorP -= l.tamano + 4;
    }
  }

  if (titulo) pdf.setTitle(sanear(`${titulo} · ${codigo}`));
  pdf.setProducer("AgendaClínica · FES Ley 19.799");
  if (firmadoAt) pdf.setModificationDate(firmadoAt);
  return pdf.save({ useObjectStreams: false });
}
