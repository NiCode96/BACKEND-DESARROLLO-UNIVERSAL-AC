import { Router } from "express";
import multer from "multer";
import ArchivoPacienteController from "../controller/ArchivoPacienteController.js";
//algo
const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/subir", upload.single("archivo"), ArchivoPacienteController.subirArchivo);
router.post("/listar", ArchivoPacienteController.listarArchivosPaciente);
router.post("/eliminar", ArchivoPacienteController.eliminarArchivo);
router.post("/descargar", ArchivoPacienteController.descargarArchivo);

export default router;