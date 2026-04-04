import mongoose from 'mongoose';
import axios from 'axios';
import {
  Investment,
  InvestmentStatus,
  InvestorType,
  PayoutStatus,
} from '../../models/Investment.model';
import {
  LPOCampaign,
  CampaignStatus,
} from '../../models/LPOCampaign.model';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler.middleware';
import { logger } from '../../utils/logger';

/**
 * Injection Service
 *
 * Responsibilities of this file — exclusively:
 *   1. All business rule enforcement (status guards, shortfall validation)
 *   2. Shortfall calculation (or override amount validation)
 *   3. Bank credit line API call
 *   4. PLATFORM_SYSTEM Investment document creation
 *   5. Atomic campaign state transition
 *   6. Locking all confirmed retail investments
 *
 * This file has zero knowledge of HTTP — no req, no res, no next().
 */

export interface InjectionResult {
  injectedAmountKes:  number;   // In cents
  bankTransactionRef: string;
}

/**
 * Executes a Platform Capital Injection.
 *
 * @param campaignId       - Target campaign ObjectId string
 * @param adminUserId      - Triggering admin's user ID (for audit trail)
 * @param overrideAmountKes - Optional: inject a specific amount (cents) instead
 *                            of the full shortfall. Must be ≤ actual shortfall.
 * @param confirmationNote  - Optional: admin note stored on the injection record
 */
export const injectPlatformCapital = async (
  campaignId:         string,
  adminUserId:        string,
  overrideAmountKes?: number,
  confirmationNote?:  string
): Promise<InjectionResult> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ── 1. Fetch and validate campaign ───────────────────────────────────────
    const campaign = await LPOCampaign.findById(campaignId)
      .select('+internalData')
      .session(session)
      .exec();

    if (!campaign) {
      throw new AppError('Campaign not found.', 404, 'CAMPAIGN_NOT_FOUND');
    }

    const validStatuses: CampaignStatus[] = [
      CampaignStatus.FUNDING,
      CampaignStatus.AWAITING_PLATFORM_FILL,
    ];

    if (!validStatuses.includes(campaign.status)) {
      throw new AppError(
        `Cannot inject capital into a campaign with status: ${campaign.status}. ` +
        `Expected: FUNDING or AWAITING_PLATFORM_FILL.`,
        400,
        'INVALID_STATUS_FOR_INJECTION'
      );
    }

    if (campaign.platformInjection.wasInjected) {
      throw new AppError(
        'Platform capital has already been injected into this campaign. ' +
        'Each campaign may only receive one injection.',
        409,
        'ALREADY_INJECTED'
      );
    }

    // ── 2. Calculate injection amount ────────────────────────────────────────
    const fullShortfallKes =
      campaign.targetAmountKes - campaign.currentFundedAmountKes;

    if (fullShortfallKes <= 0) {
      throw new AppError(
        'Campaign is already fully funded. No injection required.',
        400,
        'NO_SHORTFALL'
      );
    }

    // Validate override amount if provided
    let injectionAmountKes: number;

    if (overrideAmountKes !== undefined) {
      if (overrideAmountKes > fullShortfallKes) {
        throw new AppError(
          `Override amount (KES ${overrideAmountKes / 100}) exceeds the ` +
          `campaign shortfall (KES ${fullShortfallKes / 100}). ` +
          `Cannot inject more than the remaining gap.`,
          400,
          'OVERRIDE_EXCEEDS_SHORTFALL'
        );
      }
      injectionAmountKes = overrideAmountKes;
    } else {
      // Default: cover the full shortfall
      injectionAmountKes = fullShortfallKes;
    }

    logger.info(
      `[InjectionService] Injection initiated | Campaign: ${campaignId} | ` +
      `Shortfall: KES ${fullShortfallKes / 100} | ` +
      `Injecting: KES ${injectionAmountKes / 100} | Admin: ${adminUserId}`
    );

    // ── 3. Draw from bank credit line ────────────────────────────────────────
    const bankTransactionRef = await drawFromCreditLine(
      injectionAmountKes,
      campaignId,
      confirmationNote
    );

    // ── 4. Create PLATFORM_SYSTEM Investment document ─────────────────────────
    const [platformInvestment] = await Investment.create(
      [
        {
          campaignId:            new mongoose.Types.ObjectId(campaignId),
          investorId:            new mongoose.Types.ObjectId(env.PLATFORM_SYSTEM_USER_ID),
          investorType:          InvestorType.PLATFORM,
          amountInvestedKes:     injectionAmountKes,
          expectedReturnPercent: campaign.expectedReturnPercent,
          // Pre-save hook computes expectedProfitKes and expectedPayoutKes
          status:                InvestmentStatus.CONFIRMED,
          payoutStatus:          PayoutStatus.PENDING,
          confirmedAt:           new Date(),
          pledgedAt:             new Date(),
        },
      ],
      { session }
    );

    // ── 5. Update campaign atomically ─────────────────────────────────────────
    const isFullyFunded =
      campaign.currentFundedAmountKes + injectionAmountKes >=
      campaign.targetAmountKes;

    await LPOCampaign.findByIdAndUpdate(
      campaignId,
      {
        $inc: { currentFundedAmountKes: injectionAmountKes },
        'platformInjection.wasInjected':        true,
        'platformInjection.injectedAmountKes':  injectionAmountKes,
        'platformInjection.injectedAt':         new Date(),
        'platformInjection.bankTransactionRef': bankTransactionRef,
        // Only transition to FULLY_FUNDED if this injection closes the gap
        ...(isFullyFunded && { status: CampaignStatus.FULLY_FUNDED }),
      },
      { session }
    );

    // ── 6. Lock all confirmed retail investments if now fully funded ──────────
    if (isFullyFunded) {
      await Investment.updateMany(
        {
          campaignId: new mongoose.Types.ObjectId(campaignId),
          status:     InvestmentStatus.CONFIRMED,
          _id:        { $ne: platformInvestment._id },
        },
        { status: InvestmentStatus.LOCKED },
        { session }
      );

      await Investment.findByIdAndUpdate(
        platformInvestment._id,
        { status: InvestmentStatus.LOCKED },
        { session }
      );

      logger.info(
        `[InjectionService] Campaign ${campaignId} → FULLY_FUNDED. ` +
        `All investments locked.`
      );
    } else {
      logger.info(
        `[InjectionService] Partial injection applied to campaign ${campaignId}. ` +
        `Remaining shortfall: KES ${
          (campaign.targetAmountKes -
            campaign.currentFundedAmountKes -
            injectionAmountKes) /
          100
        }. Status remains ${campaign.status}.`
      );
    }

    await session.commitTransaction();

    logger.info(
      `[InjectionService] Injection complete | Campaign: ${campaignId} | ` +
      `Amount: KES ${injectionAmountKes / 100} | BankRef: ${bankTransactionRef}`
    );

    return { injectedAmountKes: injectionAmountKes, bankTransactionRef };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// ─── Bank Credit Line API ─────────────────────────────────────────────────────

/**
 * Draws from the revolving bank credit line.
 * Isolated into its own function for testability and future replacement
 * with the actual bank SDK client.
 *
 * Returns the bank's transaction reference string.
 */
const drawFromCreditLine = async (
  amountKes:        number,
  campaignId:       string,
  confirmationNote?: string
): Promise<string> => {
  try {
    const response = await axios.post<{ transactionRef: string }>(
      `${env.BANK_API_BASE_URL}/credit-line/draw`,
      {
        amountKes:   amountKes / 100,  // Bank API uses whole KES
        reference:   `AKRIPESA-INJECTION-${campaignId}`,
        purpose:     'LPO Campaign Underwriting',
        note:        confirmationNote ?? 'Platform Capital Injection via Admin Dashboard',
      },
      {
        headers: {
          Authorization: `Bearer ${env.BANK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15_000,
      }
    );

    return response.data.transactionRef;
  } catch (error: any) {
    const message =
      error?.response?.data?.message ?? error.message ?? 'Unknown bank API error';

    logger.error(`[InjectionService] Bank credit line draw failed: ${message}`);

    throw new AppError(
      `Bank credit line draw failed: ${message}`,
      502,
      'BANK_API_ERROR'
    );
  }
};