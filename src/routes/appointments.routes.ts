import { Router } from 'express';
import { createAppointment, getAppointments, updateAppointmentStatus } from '../controllers/appointments.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', requireAuth, createAppointment);
router.get('/', requireAuth, getAppointments);
router.patch('/:id/status', requireAuth, updateAppointmentStatus);


export default router;
