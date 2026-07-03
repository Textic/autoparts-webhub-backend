import { Router } from 'express';
import { getParts, getPartById, createPart, updatePart, deletePart } from '../controllers/parts.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', getParts);
router.get('/:id', getPartById);

// Protected write operations
router.post('/', requireAuth, createPart);
router.put('/:id', requireAuth, updatePart);
router.delete('/:id', requireAuth, deletePart);

export default router;
