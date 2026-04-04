import { Worker, Job, UnrecoverableError } from 'bullmq';
import { redisSubscriberConnection } from '../config/redis';
import { Order, OrderStatus } from '../models/Order.model';
import { User, VehicleClass } from '../models/User.model';
import {
  findNearestAvailableDriver,
  offerToDriver,
  handleNoDriverFound,
  DISPATCH_RADIUS_TIERS,
} from '../modules/dispatch/dispatch.service';
import { DispatchJobData } from './queues';
import { logger } from '../utils/logger';

/**
 * Fires when a driver's 15-second exclusive offer window expires.
 *
 * Responsibilities:
 *   1. Idempotency: abort if order already accepted or cancelled
 *   2. Re-enable the timed-out driver
 *   3. Find the next driver at the same radius
 *   4. If none: delegate to handleNoDriverFound (tier-aware radius expansion)
 *   5. If tier maxKm exhausted: order → AWAITING_DRIVER, admin alerted
 */
export const dispatchWorker = new Worker<DispatchJobData>(
  'cascading-dispatch',
  async (job: Job<DispatchJobData>) => {
    const {
      orderId,
      vehicleClass,
      pickupCoordinates,
      currentRadiusKm,
      attemptNumber,
      excludeDriverIds,
      previousDriverId,
    } = job.data;

    logger.info(
      `Dispatch worker fired | Order: ${orderId} | Attempt: ${attemptNumber} ` +
      `| Radius: ${currentRadiusKm}km | Class: ${vehicleClass}`
    );

    // ── Validate tier exists for this vehicle class ───────────────────────────
    const tier = DISPATCH_RADIUS_TIERS[vehicleClass];
    if (!tier) {
      throw new UnrecoverableError(
        `No radius tier configured for vehicle class: ${vehicleClass}. Cannot dispatch order ${orderId}.`
      );
    }

    // ── Guard: enforce hard radius cap ───────────────────────────────────────
    if (currentRadiusKm > tier.maxKm) {
      logger.error(
        `Dispatch worker received radius ${currentRadiusKm}km which exceeds ` +
        `maxKm ${tier.maxKm} for ${vehicleClass}. Escalating order ${orderId} to AWAITING_DRIVER.`
      );
      await Order.findByIdAndUpdate(orderId, { status: OrderStatus.AWAITING_DRIVER });
      return;
    }

    // ── Idempotency: check current order status ───────────────────────────────
    const order = await Order.findById(orderId)
      .select(
        'status assignedDriverId dispatchAttempts pickupLocation ' +
        'deliveryLocation commodity quantityKg transportFeeKes orderType distanceKm'
      )
      .exec();

    if (!order) {
      throw new UnrecoverableError(
        `Order ${orderId} not found. Cannot continue dispatch.`
      );
    }

    if (
      order.status === OrderStatus.DRIVER_ASSIGNED ||
      order.status === OrderStatus.IN_TRANSIT ||
      order.status === OrderStatus.DELIVERED
    ) {
      logger.info(
        `Order ${orderId} already in status ${order.status}. Stale dispatch job — skipping.`
      );
      return;
    }

    if (order.status === OrderStatus.CANCELLED) {
      logger.info(`Order ${orderId} cancelled. Stopping dispatch cascade.`);
      return;
    }

    // ── Re-enable timed-out driver ────────────────────────────────────────────
    if (previousDriverId) {
      await User.findByIdAndUpdate(previousDriverId, {
        'transporterProfile.isAvailable': true,
      });

      logger.debug(
        `Driver ${previousDriverId} offer timed out for order ${orderId}. ` +
        `Driver re-enabled. Cascading to next.`
      );
    }

    // ── Find next driver at current radius ────────────────────────────────────
    const nextDriver = await findNearestAvailableDriver(
      pickupCoordinates,
      vehicleClass as VehicleClass,
      currentRadiusKm,
      excludeDriverIds
    );

    if (nextDriver) {
      // Found a driver — offer and enqueue next timeout job
      await offerToDriver(nextDriver, job.data, order);
      return;
    }

    // ── No driver at current radius — tier-aware expansion ───────────────────
    logger.warn(
      `No available ${vehicleClass} within ${currentRadiusKm}km for order ${orderId}. ` +
      `Attempting tier expansion (max: ${tier.maxKm}km).`
    );

    await handleNoDriverFound(job.data, order);
  },
  {
    connection: redisSubscriberConnection,
    concurrency: 10,
  }
);

dispatchWorker.on('failed', async (job: Job<DispatchJobData> | undefined, err: Error) => {
  if (!job) return;

  logger.error(
    `Dispatch job FAILED | Order: ${job.data.orderId} | Error: ${err.message}`
  );

  // If the worker itself throws unexpectedly, protect the order
  await Order.findByIdAndUpdate(job.data.orderId, {
    status: OrderStatus.AWAITING_DRIVER,
  });

  // Re-enable any driver that was locked mid-offer
  if (job.data.previousDriverId) {
    await User.findByIdAndUpdate(job.data.previousDriverId, {
      'transporterProfile.isAvailable': true,
    });
  }
});

dispatchWorker.on('completed', (job: Job<DispatchJobData>) => {
  logger.debug(
    `Dispatch job completed | Order: ${job.data.orderId} | Attempt: ${job.data.attemptNumber}`
  );
});