import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { UserRole } from '../../models/User.model';
import { retryFailedPayout } from './settlement.controller';

const router = Router();

router.post(
  '/investments/:investmentId/retry-payout',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  retryFailedPayout
);

export default router;