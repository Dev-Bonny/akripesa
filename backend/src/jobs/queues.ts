import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

// ─── Job Payload Interfaces ───────────────────────────────────────────────────

export interface PayoutJobData {
  investmentId: string;
  campaignId: string;
  investorPhoneNumber: string;
  payoutAmountKes: number;
  actualProfitKes: number;
  remarks: string;
}

export interface DeadLetterJobData {
  investmentId: string;
  campaignId: string;
  originalError: string;
  exhaustedAt: string;
}

export interface DispatchJobData {
  orderId: string;
  vehicleClass: string;
  pickupCoordinates: [number, number]; // [lng, lat]
  currentRadiusKm: number;             // Starts at INITIAL_RADIUS_KM
  attemptNumber: number;               // How many drivers have been offered
  excludeDriverIds: string[];          // Drivers who declined this order
  previousDriverId?: string;           // Last driver offered (for timeout tracking)
}

// ─── Queues ───────────────────────────────────────────────────────────────────

export const payoutQueue = new Queue<PayoutJobData>('investor-payouts', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: { count: 500 },
    removeOnFail: false,
  },
});

export const deadLetterQueue = new Queue<DeadLetterJobData>('payout-dead-letter', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: false,
    removeOnFail: false,
  },
});

/**
 * Dispatch queue — one job per driver offer.
 * Each job has a 15-second delay (the exclusive offer window).
 * If the driver accepts via HTTP endpoint, the job is removed.
 * If it completes (times out), the worker cascades to the next driver.
 */
export const dispatchQueue = new Queue<DispatchJobData>('cascading-dispatch', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1,          // Each individual offer gets one shot
    removeOnComplete: true,
    removeOnFail: false,  // Keep for audit / admin review
  },
});

dispatchQueue.on('error', (err) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { logger } = require('../utils/logger');
  logger.error('DispatchQueue error:', err);
});