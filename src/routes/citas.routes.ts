import { Router } from 'express';
import { crearCita } from '../controllers/citas.controller';

const router = Router();

router.post('/', crearCita);

export default router;
