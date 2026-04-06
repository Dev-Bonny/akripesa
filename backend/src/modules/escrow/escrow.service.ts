import mongoose from 'mongoose';
import {
  Investment,
  InvestmentStatus,
} from '../../models/Investment.model';
import {
  LPOCampaign,
  CampaignStatus,
} from '../../models/LPOCampaign.model';
import { StkCallbackBody } from '../daraja/daraja.types';
import { AppError } from '../../middleware/errorHandler.middleware';
import { logger } from '../../utils/logger';

/**
 * Processes the Daraja STK Push callback.
 *
 * This is the ESCROW CONFIRMATION step.
 * When M-Pesa confirms payment, we:
 *   1. Confirm the Investment document (PLEDGED → CONFIRMED)
 *   2. Atomically increment currentFundedAmountKes on the campaign
 *   3. Check if campaign target is now met → transition to FULLY_FUNDED
 *
 * Uses findOneAndUpdate with atomic $inc to prevent race conditions
 * when multiple callbacks arrive simultaneously for the same campaign.
 */
export const processSTKCallback = async (
  callbackBody: StkCallbackBody
): Promise<void> => {
  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } =
    callbackBody;

  // Find the investment by the M-Pesa checkout request ID
  const investment = await Investment.findOne({
    mpesaCheckoutRequestId: CheckoutRequestID,
  }).exec();

  if (!investment) {
    logger.error(
      `STK Callback: No investment found for CheckoutRequestID ${CheckoutRequestID}`
    );
    return; // Silently absorb — could be a duplicate callback
  }

  // Idempotency: if already confirmed, ignore duplicate callback
  if (investment.status === InvestmentStatus.CONFIRMED) {
    logger.warn(
      `STK Callback: Investment ${investment._id} already confirmed. Ignoring duplicate.`
    );
    return;
  }

  // Payment failed (ResultCode !== 0)
  if (ResultCode !== 0) {
    await Investment.findByIdAndUpdate(investment._id, {
      status: InvestmentStatus.FAILED,
      lastPayoutError: ResultDesc,
    });
    logger.warn(
      `STK Push FAILED | Investment: ${investment._id} | Reason: ${ResultDesc}`
    );
    return;
  }

  // Extract M-Pesa receipt number from callback metadata
  const receiptItem = CallbackMetadata?.Item.find(
    (item) => item.Name === 'MpesaReceiptNumber'
  );
  const mpesaReceiptNumber = receiptItem?.Value as string | undefined;

  if (!mpesaReceiptNumber) {
    logger.error(
      `STK Callback: No receipt number in metadata for investment ${investment._id}`
    );
    return;
  }

  // Idempotency: prevent double-crediting if same receipt processed twice
  const alreadyProcessed = await Investment.findOne({ mpesaReceiptNumber }).exec();
  if (alreadyProcessed) {
    logger.warn(
      `STK Callback: Receipt ${mpesaReceiptNumber} already processed. Ignoring.`
    );
    return;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Confirm the investment
    await Investment.findByIdAndUpdate(
      investment._id,
      {
        status: InvestmentStatus.CONFIRMED,
        mpesaReceiptNumber,
        confirmedAt: new Date(),
      },
      { session }
    );

    // 2. Atomically increment campaign funded amount
    const updatedCampaign = await LPOCampaign.findByIdAndUpdate(
      investment.campaignId,
      { $inc: { currentFundedAmountKes: investment.amountInvestedKes } },
      { session, new: true }
    );

    if (!updatedCampaign) {
      throw new AppError('Campaign not found during escrow confirmation.', 500, 'CAMPAIGN_MISSING');
    }

    // 3. Check if campaign is now fully funded
    if (updatedCampaign.currentFundedAmountKes >= updatedCampaign.targetAmountKes) {
      // Transition to FULLY_FUNDED and lock all investments
      await LPOCampaign.findByIdAndUpdate(
        investment.campaignId,
        { status: CampaignStatus.FULLY_FUNDED },
        { session }
      );

      await Investment.updateMany(
        {
          campaignId: investment.campaignId,
          status: InvestmentStatus.CONFIRMED,
        },
        { status: InvestmentStatus.LOCKED },
        { session }
      );

      logger.info(
        `Campaign ${investment.campaignId} reached 100% funding. Status → FULLY_FUNDED.`
      );
    }

    await session.commitTransaction();

    logger.info(
      `STK Callback confirmed | Investment: ${investment._id} | Receipt: ${mpesaReceiptNumber} | Campaign funded: ${updatedCampaign.currentFundedAmountKes} / ${updatedCampaign.targetAmountKes}`
    );
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};