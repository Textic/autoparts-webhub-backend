import { Router } from 'express';
import { getMarcas } from '../controllers/vehiculos.controller';

const router = Router();

router.get('/marcas', getMarcas);

export default router;
