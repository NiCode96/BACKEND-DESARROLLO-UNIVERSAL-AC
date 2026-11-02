import { Router } from "express";
import multer from "multer";
import { limitePorIp } from "../middleware/limitesTasa.js";
import VerificacionController from "../controller/VerificacionController.js";
import { manejarErrorArchivo } from "../middleware/limitesArchivos.js";

/* Verificación pública (docs/firma/02 §8): sin token, con límite por IP. */

const router = Router();

const limite = (maximo) => limitePorIp(10, maximo);

// El PDF solo se usa para calcular su huella: queda en memoria y se descarta.
const subirPdf = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 } });

router.get("/:codigo", limite(30), VerificacionController.verificarCodigo);
router.post("/compararHash", limite(10), subirPdf.single("pdf"), manejarErrorArchivo, VerificacionController.compararHash);

export default router;
