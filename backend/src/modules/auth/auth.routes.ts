import { Router } from 'express';
// ✅ FIX 1: We added googleLogin to the import list
import { register, login, refresh, logout,requestOtpController,
  verifyOtpController, googleLogin } from './auth.controller'; 
import { authenticate } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validateRequest.middleware';
import {
  registerSchema,
  loginSchema,
} from './auth.validation';

const router = Router();

router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);

// ✅ FIX 2: We added the Google route right below standard login!
router.post('/google', googleLogin); 

router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);


// No validateRequest middleware here — validation is done inside the controller
// to allow the enumeration-safe 200 response on requestOtp.
router.post('/otp/request', requestOtpController);
router.post('/otp/verify',  verifyOtpController);

export default router;