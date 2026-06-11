import { Router } from 'express';
import { getRepuestos, getRepuestoById } from '../controllers/repuestos.controller';

const router = Router();

router.get('/', getRepuestos);
router.get('/:id', getRepuestoById);

export default router;
