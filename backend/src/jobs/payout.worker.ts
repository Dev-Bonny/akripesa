import { Worker, Job, UnrecoverableError } from 'bullmq';
import { redisSubscriberConnection } from '../config/redis';
import { darajaClient } from '../modules/daraja/daraja.client';
import {
  Investment,
  PayoutStatus,
} from '../models/Investment.model';
import { LPOCampaign } from '../models/LPOCampaign.model';
import { deadLetterQueue, PayoutJobData, DeadLetterJobData } from './queues';
import { logger } from '../utils/logger';

/**
 * The Payout Worker.
 *
 * Each job represents ONE investor's B2C disbursement.
 * Lifecycle per job:
 *   1. Mark investment as PROCESSING
 *   2. Call Daraja B2C API
 *   3. Store ConversationID on the investment document
 *   4. Mark investment as PROCESSING (awaiting B2C callback to confirm SUCCESS)
 *   5. On BullMQ retry: idempotency guard prevents double-payment
 *
 * IMPORTANT: The job completes after the B2C *initiation* succeeds.
 * The actual SUCCESS state is set by the Daraja B2C callback handler,
 * not by this worker directly. This matches Safaricom's async callback model.
 *
 * If the B2C initiation itself fails (network error, Daraja error),
 * BullMQ retries with exponential backoff. After all retries are
 * exhausted, the worker moves the job to the dead-letter queue.
 */
export const payoutWorker = new Worker<PayoutJobData>(
  'investor-payouts',
  async (job: Job<PayoutJobData>) => {
    const { investmentId, investorPhoneNumber, payoutAmountKes, actualProfitKes, remarks } =
      job.data;

    logger.info(
      `Payout job starting | JobID: ${job.id} | InvestmentID: ${investmentId} | Attempt: ${job.attemptsMade + 1}`
    );

    // ── Idempotency Guard ──────────────────────────────────────────────────────
    // If a previous attempt already reached Daraja successfully
    // (payoutMpesaConversationId is set), do not re-initiate.
    // The B2C callback will complete this investment.
    const investment = await Investment.findById(investmentId).exec();

    if (!investment) {
      // Investment deleted or never existed — unrecoverable, do not retry
      throw new UnrecoverableError(
        `Investment ${investmentId} not found. Skipping.`
      );
    }

    if (investment.payoutStatus === PayoutStatus.SUCCESS) {
      logger.info(
        `Investment ${investmentId} already paid out. Skipping duplicate job.`
      );
      return; // Job completes successfully, no action taken
    }

    if (investment.payoutMpesaConversationId) {
      logger.warn(
        `B2C already initiated for investment ${investmentId} (ConversationID: ${investment.payoutMpesaConversationId}). Awaiting callback. Skipping re-initiation.`
      );
      return;
    }

    // ── Mark as PROCESSING ────────────────────────────────────────────────────
    await Investment.findByIdAndUpdate(investmentId, {
      payoutStatus: PayoutStatus.PROCESSING,
      $inc: { payoutAttempts: 1 },
    });

    // ── Store actual payout figures before initiating ─────────────────────────
    await Investment.findByIdAndUpdate(investmentId, {
      actualProfitKes,
      actualPayoutKes: payoutAmountKes,
    });

    // ── Initiate B2C ──────────────────────────────────────────────────────────
    const b2cResponse = await darajaClient.initiateB2CPayout({
      phoneNumber: investorPhoneNumber,
      amountKes: payoutAmountKes, // Client converts cents → KES internally
      remarks,
      occasion: investmentId, // Matched in B2C callback to find this investment
    });

    // ── Store ConversationID (idempotency anchor for retries) ─────────────────
    await Investment.findByIdAndUpdate(investmentId, {
      payoutMpesaConversationId: b2cResponse.ConversationID,
      payoutJobId: job.id,
    });

    logger.info(
      `B2C initiated | InvestmentID: ${investmentId} | ConversationID: ${b2cResponse.ConversationID}`
    );

    // Job is COMPLETE from BullMQ's perspective.
    // SUCCESS is confirmed asynchronously by the Daraja B2C callback.
  },
  {
    connection: redisSubscriberConnection,
    concurrency: 5, // Process 5 B2C calls simultaneously — respect Daraja rate limits
  }
);

// ─── Job Failure Handler ──────────────────────────────────────────────────────

payoutWorker.on('failed', async (job: Job<PayoutJobData> | undefined, err: Error) => {
  if (!job) return;

  const { investmentId, campaignId } = job.data;
  const isExhausted = job.attemptsMade >= (job.opts.attempts ?? 5);

  logger.error(
    `Payout job failed | JobID: ${job.id} | InvestmentID: ${investmentId} | Attempt: ${job.attemptsMade} | Error: ${err.message}`
  );

  // Update last error on the investment document
  await Investment.findByIdAndUpdate(investmentId, {
    lastPayoutError: err.message,
  });

  if (isExhausted) {
    logger.error(
      `All retries exhausted for investment ${investmentId}. Moving to dead-letter queue.`
    );

    // Mark investment as FAILED / MANUAL_HOLD
    await Investment.findByIdAndUpdate(investmentId, {
      payoutStatus: PayoutStatus.MANUAL_HOLD,
      deadLetterAt: new Date(),
    });

    // Enqueue in dead-letter queue for 24hr auto-retry (Option B)
    const deadLetterPayload: DeadLetterJobData = {
      investmentId,
      campaignId,
      originalError: err.message,
      exhaustedAt: new Date().toISOString(),
    };

    await deadLetterQueue.add(
      `dead-letter:${investmentId}`,
      deadLetterPayload,
      {
        jobId: `dead-letter:${investmentId}`, // Prevent duplicate DL entries
      }
    );

    // Flag campaign for admin attention if any payout is in MANUAL_HOLD
    await LPOCampaign.findByIdAndUpdate(campaignId, {
      hasPayoutFailures: true, // Add this field to the schema
    });
  }
});

payoutWorker.on('completed', (job: Job<PayoutJobData>) => {
  logger.info(
    `Payout job completed | JobID: ${job.id} | InvestmentID: ${job.data.investmentId}`
  );
});