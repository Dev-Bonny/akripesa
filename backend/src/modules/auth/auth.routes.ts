import { Router } from 'express';
import { register, login, refresh, logout } from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validateRequest.middleware';
import {
  registerSchema,
  loginSchema,
} from './auth.validation';

const router = Router();

router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);

export default router;