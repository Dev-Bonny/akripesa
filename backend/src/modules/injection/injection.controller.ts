import { Request, Response, NextFunction } from 'express';
import { injectPlatformCapital as injectPlatformCapitalService } from './injection.service';
import { LPOCampaign } from '../../models/LPOCampaign.model';
import { sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../middleware/errorHandler.middleware';
import { InjectCapitalDto } from './injection.validation';
import { logger } from '../../utils/logger';

/**
 * Injection Controller
 *
 * Responsibilities of this file — exclusively:
 *   1. Extract and validate data from req.params, req.body, req.user
 *   2. Delegate all business logic to injection.service.ts
 *   3. Format and send the HTTP response
 *   4. Forward any errors to the global error handler via next()
 *
 * This file contains zero database queries, zero Daraja API calls,
 * and zero financial math. All of that lives in injection.service.ts.
 */

// ─── POST /:campaignId/inject ─────────────────────────────────────────────────

/**
 * Handles: POST /api/v1/campaigns/:campaignId/inject
 *
 * Parses the campaignId from the route param and the optional
 * override amount from the validated request body, then delegates
 * entirely to the injection service.
 *
 * The Zod-validated body is already attached to req.body by the
 * validateRequest middleware in the route layer — no re-validation needed here.
 */
export const injectPlatformCapital = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { campaignId } = req.params;
    const adminUserId    = req.user!.userId;

    // Body is already Zod-validated by the time it reaches here
    const { overrideAmountKes, confirmationNote } =
      req.body as InjectCapitalDto;

    logger.info(
      `[InjectionController] Injection requested | Campaign: ${campaignId} | ` +
      `Admin: ${adminUserId} | Override: ${overrideAmountKes ?? 'none'}`
    );

    // Delegate all business logic to the service layer
    const result = await injectPlatformCapitalService(
      campaignId,
      adminUserId,
      overrideAmountKes,     // undefined = service computes full shortfall
      confirmationNote
    );

    sendSuccess(
      res,
      200,
      `Platform capital injection of KES ${result.injectedAmountKes / 100} completed successfully.`,
      {
        campaignId,
        injectedAmountKes:   result.injectedAmountKes,
        injectedAmountLabel: `KES ${(result.injectedAmountKes / 100).toLocaleString('en-KE')}`,
        bankTransactionRef:  result.bankTransactionRef,
        campaignStatus:      'FULLY_FUNDED',
      }
    );
  } catch (err) {
    next(err);
  }
};

// ─── GET /:campaignId/inject/status ──────────────────────────────────────────

/**
 * Handles: GET /api/v1/campaigns/:campaignId/inject/status
 *
 * Returns the injection audit trail for a specific campaign.
 * Reads the platformInjection sub-document directly — no service
 * delegation needed as this is a pure read with no business logic.
 */
export const getInjectionStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { campaignId } = req.params;

    // Direct DB read — acceptable in controller for simple lookups
    // with no computation, branching, or side effects
    const campaign = await LPOCampaign.findById(campaignId)
      .select('platformInjection status currentFundedAmountKes targetAmountKes')
      .lean()
      .exec();

    if (!campaign) {
      throw new AppError('Campaign not found.', 404, 'CAMPAIGN_NOT_FOUND');
    }

    const injection = campaign.platformInjection;

    sendSuccess(res, 200, 'Injection status retrieved.', {
      campaignId,
      wasInjected:        injection.wasInjected,
      injectedAmountKes:  injection.injectedAmountKes,
      injectedAt:         injection.injectedAt ?? null,
      bankTransactionRef: injection.bankTransactionRef ?? null,
      isRepaid:           injection.isRepaid,
      repaidAt:           injection.repaidAt ?? null,
      campaignStatus:     campaign.status,
      fundingSnapshot: {
        currentFundedAmountKes: campaign.currentFundedAmountKes,
        targetAmountKes:        campaign.targetAmountKes,
        fundingProgressPercent: parseFloat(
          ((campaign.currentFundedAmountKes / campaign.targetAmountKes) * 100).toFixed(2)
        ),
      },
    });
  } catch (err) {
    next(err);
  }
};