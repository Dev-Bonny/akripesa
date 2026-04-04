// settlement.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { UserRole } from '../../models/User.model';
import { triggerSettlement } from './settlement.controller';
import { triggerSettlement, retryFailedPayout } from './settlement.controller';

const router = Router();

router.post(
  '/investments/:investmentId/retry-payout',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  retryFailedPayout
);

export default router;