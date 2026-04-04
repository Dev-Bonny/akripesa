import { Router } from 'express';
import { validateDarajaCallback } from '../../middleware/darajaCallback.middleware';
import {
  handleSTKCallback,
  handleB2CCallback,
  handleB2CTimeout,
} from './daraja.controller';

const router = Router();

// All routes use the callback validator middleware
// :secret is validated against env.DARAJA_CALLBACK_SECRET
router.post(
  '/stk-callback/:secret',
  validateDarajaCallback,
  handleSTKCallback
);

router.post(
  '/b2c-callback/:secret',
  validateDarajaCallback,
  handleB2CCallback
);

router.post(
  '/b2c-timeout/:secret',
  validateDarajaCallback,
  handleB2CTimeout
);

export default router;