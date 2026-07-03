import { Router } from 'express';
import { createAppointment, getAppointments, updateAppointmentStatus, updateAppointmentItems } from '../controllers/appointments.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', requireAuth, createAppointment);
router.get('/', requireAuth, getAppointments);
router.patch('/:id/status', requireAuth, updateAppointmentStatus);
router.put('/:id/items', requireAuth, updateAppointmentItems);

export default router;
