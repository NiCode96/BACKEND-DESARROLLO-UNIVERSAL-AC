import { Router } from "express";
import express from "express";
import multer from "multer";
import CloudflareController from "../controller/CloudflareController.js";
import { tipoRealImagen } from "../services/firmaImagen.js";

const router = Router();

// multer en memoria para obtener req.file.buffer y pasarlo al controlador.
// Con límites: sin ellos un solo archivo enorme llena la RAM del proceso (y el
// servidor es compartido). 10 MB es además el máximo que acepta Cloudflare Images.
export const MAX_BYTES_IMAGEN = 10 * 1024 * 1024;
export const TIPOS_IMAGEN = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES_IMAGEN, files: 1, fields: 10, fieldSize: 64 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (TIPOS_IMAGEN.has(file.mimetype)) return cb(null, true);
        const error = new Error("tipo-no-permitido");
        error.code = "TIPO_NO_PERMITIDO";
        return cb(error);
    },
});

// Errores de multer → JSON claro (antes caían al manejador por defecto de Express)
function subirUnaImagen(req, res, next) {
    upload.single("image")(req, res, (error) => {
        if (!error) return next();
        if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "imagen-muy-pesada" });
        if (error.code === "TIPO_NO_PERMITIDO") return res.status(415).json({ message: "tipo-no-permitido" });
        if (error instanceof multer.MulterError) return res.status(400).json({ message: "subida-invalida" });
        return next(error);
    });
}

// Segunda barrera: los bytes reales deben ser una imagen (el mimetype se puede falsear)
function verificarFirmaImagen(req, res, next) {
    if (!req.file) return next(); // el controlador responde "sinimagen"
    if (!tipoRealImagen(req.file.buffer)) return res.status(415).json({ message: "tipo-no-permitido" });
    return next();
}

// Subir imagen (multipart/form-data, campo 'image')
router.post("/subirimagenes", subirUnaImagen, verificarFirmaImagen, CloudflareController.uploadImage);

// Crear URL de subida directa (JSON body)
router.post("/api/images/direct-upload", express.json(), CloudflareController.createDirectUploadUrl);


export default router;