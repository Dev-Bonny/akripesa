import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { UserRole } from '../../models/User.model';
import * as InvestmentController from './investment.controller';
import { retryFailedPayout } from '../settlement/settlement.controller';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// This router is mounted at /api/v1/campaigns/investments in app.ts.
// All paths below are RELATIVE to that mount point.
//
// Full resolved paths:
//   GET  /api/v1/campaigns/investments/manual-hold
//   POST /api/v1/campaigns/investments/pledge
//   GET  /api/v1/campaigns/investments/my-portfolio
//   POST /api/v1/campaigns/investments/:investmentId/retry-payout
//
// STATIC routes are registered BEFORE dynamic /:investmentId routes.
// ─────────────────────────────────────────────────────────────────────────────

// ── Admin static routes ───────────────────────────────────────────────────────

router.get(
  '/manual-hold',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  InvestmentController.getManualHoldInvestments
);

// ── Investor static routes ────────────────────────────────────────────────────

router.post(
  '/pledge',
  authenticate,
  authorize(UserRole.RETAIL_INVESTOR, UserRole.BULK_BROKER),
  InvestmentController.pledgeInvestment
);

router.get(
  '/my-portfolio',
  authenticate,
  authorize(UserRole.RETAIL_INVESTOR, UserRole.BULK_BROKER),
  InvestmentController.getMyPortfolio
);

// ── Dynamic routes (must come after all static routes) ───────────────────────

router.post(
  '/:investmentId/retry-payout',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  retryFailedPayout
);

export default router;