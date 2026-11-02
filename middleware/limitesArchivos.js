import multer from "multer";

/* Límites de tamaño para los archivos de la firma electrónica (docs/firma/03 §9.1).
 * multer deja de leer el archivo apenas pasa el límite, así un archivo enorme
 * nunca llega entero a la memoria del servidor. */

const memoria = multer.memoryStorage();

export const subirPdfBorrador = multer({ storage: memoria, limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 20 } });
export const subirImagenFirma = multer({ storage: memoria, limits: { fileSize: 512 * 1024, files: 1, fields: 10, fieldSize: 256 * 1024 } });
export const subirCertificado = multer({ storage: memoria, limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 } });

/**
 * Va justo después de upload.single(...). Traduce los errores de multer a
 * respuestas del contrato en vez de dejar que terminen como 500.
 */
export function manejarErrorArchivo(error, req, res, next) {
    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "archivoDemasiadoGrande" });
        return res.status(400).json({ message: "archivoInvalido" });
    }
    return next(error);
}

/** Tipo real del archivo por sus primeros bytes (no confiar en el mimetype que manda el navegador). */
export function tipoPorFirmaMagica(buffer) {
    if (!buffer || buffer.length < 4) return null;
    if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
    if (buffer[0] === 0x89 && buffer.subarray(1, 4).toString("latin1") === "PNG") return "image/png";
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
    return null;
}
