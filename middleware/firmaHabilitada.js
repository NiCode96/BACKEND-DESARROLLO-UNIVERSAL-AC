import { claveHmac } from "../services/firma/huellas.js";

/* Interruptor de emergencia (docs/firma/03 §9.7).
 *
 * FIRMA_HABILITADA=0 en el .env apaga la firma sin desplegar código: las rutas
 * que generan o firman documentos responden 503 y el resto de la plataforma
 * sigue funcionando. Descargar lo ya firmado y la verificación pública siguen
 * disponibles (no usan este middleware).
 *
 * También falla cerrado si falta FIRMA_HMAC_CLAVE: sin la clave no se puede
 * sellar la evidencia, así que no se firma nada. */

export function firmaHabilitada(req, res, next) {
    if (process.env.FIRMA_HABILITADA === "0") return res.status(503).json({ message: "servicioOcupado" });
    try {
        claveHmac();
    } catch (error) {
        console.error(error.message);
        return res.status(503).json({ message: "serverError" });
    }
    return next();
}
