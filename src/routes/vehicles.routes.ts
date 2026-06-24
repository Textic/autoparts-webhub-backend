import { Router } from 'express';
import { getBrands, getModelsByBrand, getYearsByModel, getVehicles } from '../controllers/vehicles.controller';

const router = Router();

router.get('/brands', getBrands);
router.get('/models', getModelsByBrand);
router.get('/years', getYearsByModel);
router.get('/', getVehicles);

export default router;
