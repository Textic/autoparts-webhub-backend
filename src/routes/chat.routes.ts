import { Router } from 'express';
import { handleChat } from '../controllers/chat.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', requireAuth, handleChat);

export default router;
