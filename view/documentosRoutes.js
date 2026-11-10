import { Router } from "express";
import DocumentosController from "../controller/DocumentosController.js";
import { exigirUsuarioClerk } from "../middleware/exigirUsuarioClerk.js";
import { exigirReverificacion } from "../middleware/exigirReverificacion.js";
import { firmaHabilitada } from "../middleware/firmaHabilitada.js";
import { subirPdfBorrador, manejarErrorArchivo } from "../middleware/limitesArchivos.js";
import { limitePorUsuario } from "../middleware/limitesTasa.js";

/* Documentos con firma electrónica (docs/firma/02 §6). Todas exigen sesión.
 * firmaHabilitada: el interruptor de emergencia (FIRMA_HABILITADA=0) apaga lo que
 * crea o firma documentos; descargar y enviar lo ya firmado siguen funcionando. */

const router = Router();
router.use(exigirUsuarioClerk);

router.post("/prepararDocumento", firmaHabilitada, limitePorUsuario(10, 30),
    subirPdfBorrador.single("pdf"), manejarErrorArchivo, DocumentosController.prepararDocumento);
router.post("/seleccionarBorrador", DocumentosController.seleccionarBorrador);
router.post("/firmarDocumento", firmaHabilitada, exigirReverificacion(), limitePorUsuario(10, 20), DocumentosController.firmarDocumento);
router.post("/descargarDocumento", DocumentosController.descargarDocumento);
router.post("/enviarDocumentoCorreo", limitePorUsuario(10, 20), DocumentosController.enviarDocumentoCorreo);
router.post("/listarDocumentosPaciente", DocumentosController.listarDocumentosPaciente);
router.post("/listarPendientesFirma", DocumentosController.listarPendientesFirma);
router.post("/anularDocumento", exigirReverificacion(), DocumentosController.anularDocumento);
router.post("/solicitarOtpPaciente", firmaHabilitada, limitePorUsuario(10, 15), DocumentosController.solicitarOtpPaciente);
router.post("/verificarOtpPaciente", firmaHabilitada, limitePorUsuario(10, 30), DocumentosController.verificarOtpPaciente);

export default router;
