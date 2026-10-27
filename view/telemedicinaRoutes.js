import {Router} from 'express';
import { exigirSesionClerk } from "../middleware/exigirSesionClerk.js";

import TelemedicinaController from "../controller/TelemedicinaController.js";
const router = Router();
router.post('/nuevaSala', exigirSesionClerk, TelemedicinaController.nuevaSalaTelemedicina);
router.post('/tokenSala', TelemedicinaController.nuevaTokenSala);

export default router;
