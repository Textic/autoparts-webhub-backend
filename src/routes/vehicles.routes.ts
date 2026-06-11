import { Router } from 'express';
import { getBrands } from '../controllers/vehicles.controller';

const router = Router();

router.get('/brands', getBrands);

export default router;
