/* Normalización de la grafía (firma dibujada) en el servidor.
 *
 * El PNG que manda el navegador NUNCA se usa tal cual: se recorta al contorno de
 * la firma, se lleva a 200 px de alto (máximo 600 de ancho) y se vuelve a
 * codificar. La huella imagen_sha256 se calcula sobre ESTE resultado, que es el
 * que se estampa en los documentos. */

import sharp from "sharp";

sharp.concurrency(1); // sharp usa por defecto todos los núcleos
sharp.cache(false);   // y guarda caché en memoria

const error = (codigo) => Object.assign(new Error(codigo), { codigo, status: 422 });

export async function normalizarFirma(buffer) {
    let meta;
    try {
        meta = await sharp(buffer, { limitInputPixels: 2_000_000 }).metadata();
    } catch {
        throw error("pngInvalido");
    }
    if (meta.format !== "png" || !meta.width || meta.width > 2000 || meta.height > 1000) throw error("pngInvalido");

    let salida;
    try {
        salida = await sharp(buffer, { limitInputPixels: 2_000_000 })
            .ensureAlpha()
            .trim({ threshold: 8 })
            .resize({ height: 200, width: 600, fit: "inside" })
            .png({ compressionLevel: 9 })
            .toBuffer({ resolveWithObject: true });
    } catch {
        // trim() falla si la imagen está completamente vacía
        throw error("pngInvalido");
    }
    const { width, height } = salida.info;
    if (width < 20 || height < 20) throw error("pngInvalido");
    const { channels } = await sharp(salida.data).stats();
    if (channels[3] && channels[3].max < 32) throw error("pngInvalido"); // prácticamente transparente
    return { buffer: salida.data, ancho: width, alto: height };
}

/** Trazos del pad: [[{x,y,t},…],…]. Entre 20 y 20 000 puntos en total. */
export function trazosValidos(trazos) {
    if (!Array.isArray(trazos) || trazos.length === 0) return false;
    let puntos = 0;
    for (const trazo of trazos) {
        if (!Array.isArray(trazo)) return false;
        for (const p of trazo) {
            if (!p || ![p.x, p.y, p.t].every((n) => typeof n === "number" && Number.isFinite(n))) return false;
            puntos++;
        }
    }
    return puntos >= 20 && puntos <= 20000;
}
