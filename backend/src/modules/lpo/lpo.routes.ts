import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { sanitizeCampaignResponse } from '../../middleware/sanitizer.middleware';
import { UserRole } from '../../models/User.model';
import * as LPOController from './lpo.controller';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// This router is mounted at /api/v1/campaigns in app.ts.
// All paths below are RELATIVE to that mount point.
//
// Full resolved paths:
//   GET  /api/v1/campaigns/admin/all
//   GET  /api/v1/campaigns/admin/payout-summaries
//   POST /api/v1/campaigns
//   GET  /api/v1/campaigns
//   PATCH /api/v1/campaigns/:campaignId
//   POST /api/v1/campaigns/:campaignId/publish
//   GET  /api/v1/campaigns/:campaignId/admin
//
// STATIC routes (/admin/all, /admin/payout-summaries) MUST be registered
// before dynamic routes (/:campaignId) — Express matches in order and would
// treat the string "admin" as a campaignId if dynamic routes came first.
// ─────────────────────────────────────────────────────────────────────────────

// ── Admin static routes ───────────────────────────────────────────────────────

router.get(
  '/admin/all',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  LPOController.getAllCampaignsForAdmin
);

router.get(
  '/admin/payout-summaries',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  LPOController.getPayoutSummaries
);

// ── Campaign creation ─────────────────────────────────────────────────────────

router.post(
  '/',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  LPOController.createCampaign
);

// ── Public / Investor routes (sanitizer applied) ──────────────────────────────

router.get(
  '/',
  authenticate,
  authorize(
    UserRole.RETAIL_INVESTOR,
    UserRole.BULK_BROKER,
    UserRole.SUPER_ADMIN
  ),
  sanitizeCampaignResponse,
  LPOController.getPublicCampaigns
);

// ── Admin dynamic routes (/:campaignId — always after static routes) ──────────

router.patch(
  '/:campaignId',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  LPOController.updateCampaign
);

router.post(
  '/:campaignId/publish',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  LPOController.publishCampaign
);

router.get(
  '/:campaignId/admin',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  LPOController.getAdminCampaign
);

export default router;