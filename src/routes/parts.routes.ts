import { Router } from 'express';
import { getParts, getPartById } from '../controllers/parts.controller';

const router = Router();

router.get('/', getParts);
router.get('/:id', getPartById);

export default router;
