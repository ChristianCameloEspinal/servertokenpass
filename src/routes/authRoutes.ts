// routes/auth.ts (O donde defines tus rutas)
import { Router } from 'express';
import { register } from '../controllers/authController';
import { checkUser, validateUser } from '../controllers/validateControllers';

const router = Router();

router.post('/register', register);
router.post('/checkuser', checkUser);
router.post('/validateuser', validateUser);

export default router;
