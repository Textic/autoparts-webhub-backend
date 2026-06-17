import { Router } from 'express';
import { getBrands, getModelsByBrand, getYearsByModel } from '../controllers/vehicles.controller';

const router = Router();

router.get('/brands', getBrands);
router.get('/models', getModelsByBrand);
router.get('/years', getYearsByModel);

export default router;
