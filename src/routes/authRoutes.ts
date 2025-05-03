// routes/auth.ts (O donde defines tus rutas)
import { Router } from 'express';
import { register } from '../controllers/authController';

const router = Router();

router.post('/register', register);


export default router;
