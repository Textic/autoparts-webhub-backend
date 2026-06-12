import { Router } from 'express';
import { createAppointment } from '../controllers/appointments.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', requireAuth, createAppointment);

export default router;
