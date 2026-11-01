/*
    firmaImagen.js
    Comprueba por los primeros bytes que un archivo sea de verdad una imagen.
    El mimetype lo declara el navegador y se puede falsear; la firma no.
    Función pura: se prueba en pruebas/datosEmpresa/.
*/

const empiezaCon = (buf, bytes, desde = 0) => bytes.every((b, i) => buf[desde + i] === b);
const ascii = (buf, desde, largo) => buf.subarray(desde, desde + largo).toString("latin1");

export function tipoRealImagen(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
    if (empiezaCon(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";
    if (empiezaCon(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
    if (ascii(buffer, 0, 6) === "GIF87a" || ascii(buffer, 0, 6) === "GIF89a") return "image/gif";
    if (ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 4) === "WEBP") return "image/webp";
    if (ascii(buffer, 4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(buffer, 8, 4))) return "image/avif";
    return null;
}
