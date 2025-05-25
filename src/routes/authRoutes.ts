// routes/auth.ts (O donde defines tus rutas)
import { Router } from 'express';
import { login, register, updateUser } from '../controllers/authController';
import { checkUser, checkUserRaw, validateUser } from '../controllers/validateControllers';
import { createSafelist } from '../services/smsService';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/check', authenticate, checkUser);
router.post('/checkraw', checkUserRaw);
router.post('/validate',authenticate, validateUser);
router.post('/login',login);
router.put('/update',authenticate,updateUser);
//router.post('/safe',createSafelist)

export default router;
