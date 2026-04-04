// src/jobs/deadLetter.worker.ts
import { Worker, Job } from 'bullmq';
import { redisSubscriberConnection } from '../config/redis';
import { Investment, PayoutStatus } from '../models/Investment.model';
import { LPOCampaign } from '../models/LPOCampaign.model';
import { DeadLetterJobData } from './queues';
import { logger } from '../utils/logger';

/**
 * Dead Letter Worker — Option A (Manual Hold Only).
 *
 * Does NOT auto-retry. Responsibilities:
 *   1. Ensure investment is firmly in MANUAL_HOLD
 *   2. Set hasPayoutFailures flag on the campaign (admin dashboard alert)
 *   3. Log a structured alert for your monitoring system (Datadog, etc.)
 *
 * Re-trigger path: Admin sees the flag on the dashboard (Sprint 5),
 * clicks "Retry Payout" on the specific investment, which calls a
 * dedicated admin endpoint that re-enqueues a single job into payoutQueue.
 */
export const deadLetterWorker = new Worker<DeadLetterJobData>(
  'payout-dead-letter',
  async (job: Job<DeadLetterJobData>) => {
    const { investmentId, campaignId, originalError, exhaustedAt } = job.data;

    logger.error(
      `[DEAD LETTER] Investment ${investmentId} requires manual admin intervention | Campaign: ${campaignId} | Original error: ${originalError} | Exhausted at: ${exhaustedAt}`
    );

    await Investment.findByIdAndUpdate(investmentId, {
      payoutStatus: PayoutStatus.MANUAL_HOLD,
      lastPayoutError: `All retries exhausted. Manual re-trigger required. Last error: ${originalError}`,
      deadLetterAt: new Date(exhaustedAt),
    });

    // Flag the campaign so the admin dashboard surfaces it immediately
    await LPOCampaign.findByIdAndUpdate(campaignId, {
      hasPayoutFailures: true,
    });

    // Structured log — pipe this to your alerting system (PagerDuty, Slack webhook, etc.)
    logger.error('[ALERT] Manual payout intervention required', {
      investmentId,
      campaignId,
      originalError,
      exhaustedAt,
      action: 'Admin must visit dashboard and click Retry Payout on this investment.',
    });
  },
  { connection: redisSubscriberConnection, concurrency: 2 }
);

deadLetterWorker.on('failed', (_job, err) => {
  // The dead-letter worker itself failed — this is a critical system error
  logger.error('[CRITICAL] Dead-letter worker job failed:', err);
});