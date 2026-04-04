import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { UserRole } from '../../models/User.model';
import * as OrderController from './order.controller';

const router = Router();

// ── Admin static routes ─────────────────────────────────────────────────────
// IMPORTANT: Static routes must be registered before dynamic /:orderId routes.

router.get(
  '/admin/active',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  OrderController.getActiveOrders
);

router.post(
  '/b2b',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  OrderController.createB2BOrder
);

// ── Dynamic order routes (with :orderId param) ──────────────────────────────

router.post(
  '/:orderId/verify-loading',
  authenticate,
  authorize(UserRole.TRANSPORTER),
  OrderController.verifyLoading
);

router.post(
  '/:orderId/verify-delivery',
  authenticate,
  authorize(UserRole.TRANSPORTER),
  OrderController.verifyDelivery
);

router.post(
  '/:orderId/reroute',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  OrderController.rerouteOrder
);

export default router;