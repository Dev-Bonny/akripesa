import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { UserRole } from '../../models/User.model';
import { validateRequest } from '../../middleware/validateRequest.middleware';
import { injectCapitalSchema } from './injection.validation';
import {
  injectPlatformCapital,
  getInjectionStatus,
} from './injection.controller';

/**
 * Injection Routes
 *
 * Responsibilities of this file — exclusively:
 *   1. Define HTTP method + path for each endpoint
 *   2. Attach authentication middleware
 *   3. Attach role-based authorization guards
 *   4. Attach request validation middleware
 *   5. Attach the controller handler
 *
 * This file contains zero business logic, zero database calls,
 * and zero response formatting. All of that lives in the controller
 * and service layers respectively.
 */

const router = Router();

/**
 * POST /api/v1/campaigns/:campaignId/inject
 *
 * Triggers a Platform Capital Injection for an underfunded campaign.
 * Draws from the bank revolving credit line to cover the funding shortfall.
 *
 * Auth:    SUPER_ADMIN only
 * Body:    validated by injectCapitalSchema (optional override amount)
 */
router.post(
  '/:campaignId/inject',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  validateRequest(injectCapitalSchema),
  injectPlatformCapital
);

/**
 * GET /api/v1/campaigns/:campaignId/inject/status
 *
 * Returns the current injection status for a campaign.
 * Used by the Underwriting Hub to display injection audit trail.
 *
 * Auth:    SUPER_ADMIN only
 * Body:    none
 */
router.get(
  '/:campaignId/inject/status',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  getInjectionStatus
);

export default router;