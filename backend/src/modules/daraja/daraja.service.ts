import { Investment, InvestmentStatus, PayoutStatus } from '../../models/Investment.model';
import { LPOCampaign, CampaignStatus } from '../../models/LPOCampaign.model';
import { B2CCallback } from './daraja.types';
import { logger } from '../../utils/logger';

type B2CResult = B2CCallback['Result'];

/**
 * Processes the Daraja B2C result callback.
 * This is where an investment transitions to PayoutStatus.SUCCESS.
 *
 * The worker enqueued the B2C call. This callback confirms the money
 * physically arrived in the investor's M-Pesa account.
 */
export const processB2CCallback = async (result: B2CResult): Promise<void> => {
  // The 'Occasion' field on the B2C request was set to the investmentId
  const investmentId = result.ReferenceData?.ReferenceItem?.Value;

  if (!investmentId) {
    logger.error('B2C Callback: No investmentId in ReferenceData.', result);
    return;
  }

  const investment = await Investment.findById(investmentId).exec();

  if (!investment) {
    logger.error(`B2C Callback: Investment ${investmentId} not found.`);
    return;
  }

  // Idempotency guard
  if (investment.payoutStatus === PayoutStatus.SUCCESS) {
    logger.warn(`B2C Callback: Investment ${investmentId} already marked SUCCESS. Ignoring.`);
    return;
  }

  if (result.ResultCode !== 0) {
    // B2C failed — BullMQ retry logic will re-attempt
    // The worker's 'failed' event handler manages the retry/dead-letter flow
    logger.error(
      `B2C FAILED | Investment: ${investmentId} | Code: ${result.ResultCode} | Desc: ${result.ResultDesc}`
    );

    await Investment.findByIdAndUpdate(investmentId, {
      payoutStatus: PayoutStatus.FAILED,
      lastPayoutError: result.ResultDesc,
    });
    return;
  }

  // Success — extract the M-Pesa transaction ID from result parameters
  const receiptParam = result.ResultParameters?.ResultParameter.find(
    (p) => p.Key === 'TransactionReceipt'
  );
  const mpesaReceiptNumber = receiptParam?.Value as string | undefined;

  await Investment.findByIdAndUpdate(investmentId, {
    payoutStatus: PayoutStatus.SUCCESS,
    status: InvestmentStatus.PAID_OUT,
    payoutMpesaReceiptNumber: mpesaReceiptNumber,
    paidOutAt: new Date(),
    lastPayoutError: undefined,
  });

  logger.info(
    `B2C SUCCESS | Investment: ${investmentId} | Receipt: ${mpesaReceiptNumber}`
  );

  // Check if all investments on this campaign are now paid out
  await checkAndFinalizeCampaign(investment.campaignId.toString());
};

/**
 * Handles B2C queue timeout — Safaricom could not process the request in time.
 * Treated as a transient failure; BullMQ retry will re-initiate the B2C call.
 */
export const processB2CTimeout = async (result: B2CResult): Promise<void> => {
  const investmentId = result.ReferenceData?.ReferenceItem?.Value;

  if (!investmentId) {
    logger.error('B2C Timeout: No investmentId in ReferenceData.');
    return;
  }

  logger.warn(
    `B2C TIMEOUT | Investment: ${investmentId} | Clearing ConversationID for retry.`
  );

  // Clear the ConversationID so the idempotency guard in the worker resets
  // and the next BullMQ retry will re-initiate a fresh B2C call
  await Investment.findByIdAndUpdate(investmentId, {
    payoutMpesaConversationId: undefined,
    payoutStatus: PayoutStatus.FAILED,
    lastPayoutError: 'Safaricom B2C queue timeout. Will retry.',
  });
};

/**
 * After each successful B2C callback, checks if ALL investments
 * on the campaign have been paid out. If so, marks the campaign COMPLETED.
 */
const checkAndFinalizeCampaign = async (campaignId: string): Promise<void> => {
  const pendingCount = await Investment.countDocuments({
    campaignId,
    payoutStatus: { $nin: [PayoutStatus.SUCCESS] },
    status: { $nin: [InvestmentStatus.PAID_OUT] },
  });

  if (pendingCount === 0) {
    await LPOCampaign.findByIdAndUpdate(campaignId, {
      status: CampaignStatus.COMPLETED,
    });
    logger.info(
      `All payouts complete. Campaign ${campaignId} → COMPLETED.`
    );
  }
};