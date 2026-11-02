/* Constancia en PDF de un consentimiento aceptado en la reserva pública.
 *
 * Se genera UNA sola vez, al registrar la aceptación, y se guarda en R2 con su
 * SHA-256. Es la prueba de qué texto exacto aceptó el paciente, cuándo y cómo
 * (Ley 19.799: el documento electrónico debe poder reproducirse íntegro).
 * Nunca se vuelve a generar: las descargas y los correos usan el archivo guardado.
 *
 * Mismo lenguaje visual que los documentos del front (motorDocumento.js). */

import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { bloquesDeTexto } from "./plantillas.js";

const NEGRO = [29, 29, 31];
const OSCURO = [58, 58, 60];
const MEDIO = [110, 110, 115];
const ACENTO = [0, 102, 204];
const BORDE = [222, 222, 227];
const FONDO = [244, 244, 247];

/**
 * @param {object} p
 * @param {object} p.empresa          fila de datos_empresa
 * @param {string} p.titulo           título de la plantilla
 * @param {string} p.codigoPlantilla  "tratamiento_datos"
 * @param {number} p.version
 * @param {string} p.textoSha256      huella del texto interpolado
 * @param {string} p.texto            texto interpolado que vio el paciente
 * @param {object} p.paciente         { nombre, apellido, tipo_documento, documento }
 * @param {string} p.textoFecha       "22-10-2026 22:25:57 (UTC-03:00)"
 * @param {string} p.codigo           código de verificación
 * @param {string} p.urlVerificacion  URL del QR
 * @returns {Promise<Buffer>}
 */
export async function generarConstancia({ empresa, titulo, codigoPlantilla, version, textoSha256, texto, paciente, textoFecha, codigo, urlVerificacion }) {
    const doc = new jsPDF("p", "mm", "letter");
    const ancho = doc.internal.pageSize.getWidth();
    const alto = doc.internal.pageSize.getHeight();
    const m = 20;
    const util = ancho - m * 2;
    const limite = alto - 22;
    const nombreEmpresa = String(empresa?.empresaNombre || "Centro de salud");
    let y = 0;

    const fuente = (estilo, tamano, color) => { doc.setFont("helvetica", estilo); doc.setFontSize(tamano); doc.setTextColor(...color); };
    const salto = (tamano) => tamano * 0.3528 * 1.42;

    function encabezado() {
        fuente("bold", 14, NEGRO);
        doc.text(nombreEmpresa, m, 16);
        fuente("normal", 7.5, MEDIO);
        const contacto = [empresa?.contactoDireccion, empresa?.contactoTelefono, empresa?.contactoEmail].filter(Boolean).join("   ·   ");
        if (contacto) doc.text(doc.splitTextToSize(contacto, util - 70)[0], m, 21.2);
        fuente("bold", 7, ACENTO);
        doc.text("CONSTANCIA DE ACEPTACIÓN", ancho - m, 15.4, { align: "right" });
        fuente("normal", 8, OSCURO);
        doc.text(`Código ${codigo}`, ancho - m, 21.2, { align: "right" });
        doc.setDrawColor(...BORDE);
        doc.setLineWidth(0.3);
        doc.line(m, 26, ancho - m, 26);
        y = 35;
    }
    function asegurar(altoBloque) {
        if (y + altoBloque > limite) { doc.addPage(); encabezado(); }
    }
    function lineas(textoParrafo, { tamano = 9.3, color = OSCURO, estilo = "normal", sangria = 0 } = {}) {
        fuente(estilo, tamano, color);
        const partes = doc.splitTextToSize(String(textoParrafo), util - sangria);
        partes.forEach((linea, i) => {
            asegurar(salto(tamano));
            const base = y + salto(tamano) * 0.74;
            if (i < partes.length - 1) doc.text([linea, ""], m + sangria, base, { align: "justify", maxWidth: util - sangria });
            else doc.text(linea, m + sangria, base);
            y += salto(tamano);
        });
        y += 2;
    }

    encabezado();
    fuente("bold", 17, NEGRO);
    doc.text(doc.splitTextToSize(String(titulo), util), m, y + 5);
    y += doc.splitTextToSize(String(titulo), util).length * salto(17) + 1;
    fuente("normal", 10.5, MEDIO);
    doc.text(`Versión ${version} · aceptada electrónicamente`, m, y + 4);
    y += 11;

    for (const bloque of bloquesDeTexto(texto)) {
        if (bloque.tipo === "titulo" || bloque.tipo === "subtitulo") {
            y += 2;
            asegurar(14);
            fuente("bold", bloque.tipo === "titulo" ? 10.5 : 9.5, NEGRO);
            doc.text(bloque.texto, m, y + 4);
            y += 8;
        } else if (bloque.tipo === "lista") {
            for (const item of bloque.items) {
                asegurar(salto(9.3));
                fuente("normal", 9.3, MEDIO);
                doc.text("•", m + 1.2, y + salto(9.3) * 0.74);
                lineas(item, { sangria: 5.5 });
                y -= 1.4;
            }
            y += 1.6;
        } else {
            lineas(bloque.texto);
        }
    }

    // Bloque de aceptación con QR (siempre entero en la misma página).
    const altoBloque = 44;
    y += 4;
    asegurar(altoBloque);
    doc.setFillColor(...FONDO);
    doc.roundedRect(m, y, util, altoBloque, 2.5, 2.5, "F");
    const qr = await QRCode.toDataURL(urlVerificacion, { errorCorrectionLevel: "M", margin: 1, width: 360 });
    doc.addImage(qr, "PNG", ancho - m - 34, y + 5, 30, 30);
    fuente("normal", 7, MEDIO);
    doc.text(codigo, ancho - m - 19, y + 39, { align: "center" });

    const documento = paciente.tipo_documento === "pasaporte" ? `Pasaporte ${paciente.documento}` : `RUT ${paciente.documento}`;
    const filas = [
        ["Aceptado por", `${paciente.nombre} ${paciente.apellido} · ${documento}`],
        ["Fecha y hora", textoFecha],
        ["Método", "Aceptación expresa en el formulario web de reserva"],
        ["Texto aceptado", `${codigoPlantilla} v${version} · huella ${textoSha256.slice(0, 12)}…${textoSha256.slice(-6)}`],
        ["Verificación", urlVerificacion],
    ];
    let cursor = y + 8;
    for (const [rotulo, valor] of filas) {
        fuente("bold", 6.5, MEDIO);
        doc.text(rotulo.toUpperCase(), m + 5, cursor);
        fuente("normal", 8.5, NEGRO);
        doc.text(doc.splitTextToSize(String(valor), util - 48)[0], m + 32, cursor);
        cursor += 6.6;
    }
    y += altoBloque;

    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setDrawColor(232, 232, 236);
        doc.line(m, alto - 16, ancho - m, alto - 16);
        fuente("normal", 6.6, [160, 160, 166]);
        doc.text(`${nombreEmpresa}   ·   Documento electrónico, Ley 19.799`, m, alto - 12);
        doc.text(`Página ${p} de ${total}`, ancho - m, alto - 12, { align: "right" });
    }
    doc.setProperties({ title: `${titulo} · ${codigo}`, creator: "AgendaClínica" });
    return Buffer.from(doc.output("arraybuffer"));
}
