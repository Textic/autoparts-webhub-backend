import { Router } from 'express';
import { crearUsuario } from '../controllers/usuarios.controller';

const router = Router();

router.post('/registro', crearUsuario);

export default router;
