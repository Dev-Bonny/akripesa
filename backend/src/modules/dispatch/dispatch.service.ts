import mongoose from 'mongoose';
import { User, UserRole, VehicleClass } from '../../models/User.model';
import { Order, OrderStatus, OrderType, IOrder } from '../../models/Order.model';
import { dispatchQueue, DispatchJobData } from '../../jobs/queues';
import { getIO } from '../../sockets';
import { DispatchOffer } from '../../sockets/socket.types';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler.middleware';

// ─── Vehicle-Class Radius Tiers ───────────────────────────────────────────────

/**
 * Dispatch radius tiers enforced per vehicle class.
 *
 * Tier 1 (Boda, Pickup): Short-range, unit economics collapse beyond 10km deadhead.
 * Tier 2 (Canter, FRR):  Long-range bulk freight — 100km deadhead is standard.
 *
 * The worker iterates through stepsKm in order.
 * Once maxKm is exceeded with no driver found, the cascade stops
 * and the order is flagged AWAITING_DRIVER for admin intervention.
 */
export interface RadiusTier {
  stepsKm: number[];  // Progressive expansion steps
  maxKm: number;      // Hard cap — cascade stops here
}

export const DISPATCH_RADIUS_TIERS: Record<string, RadiusTier> = {
  [VehicleClass.BODA]: {
    stepsKm: [2, 5, 10],
    maxKm: 10,
  },
  [VehicleClass.PICKUP]: {
    stepsKm: [2, 5, 10],
    maxKm: 10,
  },
  [VehicleClass.CANTER]: {
    stepsKm: [20, 50, 100],
    maxKm: 100,
  },
  [VehicleClass.FRR_TRUCK]: {
    stepsKm: [20, 50, 100],
    maxKm: 100,
  },
};

/**
 * Given a vehicle class and current radius, returns the next radius step.
 * Returns null if the current radius is already at or beyond maxKm.
 */
export const getNextRadiusStep = (
  vehicleClass: string,
  currentRadiusKm: number
): number | null => {
  const tier = DISPATCH_RADIUS_TIERS[vehicleClass];

  if (!tier) {
    logger.error(`No radius tier defined for vehicle class: ${vehicleClass}`);
    return null;
  }

  const currentIndex = tier.stepsKm.indexOf(currentRadiusKm);

  // Current radius not in the steps array — treat as first step
  if (currentIndex === -1) {
    return tier.stepsKm[0] ?? null;
  }

  const nextIndex = currentIndex + 1;

  // Next step exists and is within the max cap
  if (nextIndex < tier.stepsKm.length && tier.stepsKm[nextIndex] <= tier.maxKm) {
    return tier.stepsKm[nextIndex];
  }

  // All steps exhausted — cascade must stop
  return null;
};

// ─── Driver Search ────────────────────────────────────────────────────────────

export const findNearestAvailableDriver = async (
  pickupCoordinates: [number, number],
  vehicleClass: VehicleClass,
  radiusKm: number,
  excludeDriverIds: string[]
): Promise<typeof User.prototype | null> => {
  const radiusMeters = radiusKm * 1000;

  const driver = await User.findOne({
    role: UserRole.TRANSPORTER,
    isActive: true,
    'transporterProfile.vehicleClass': vehicleClass,
    'transporterProfile.isAvailable': true,
    'transporterProfile.currentLocation': {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: pickupCoordinates,
        },
        $maxDistance: radiusMeters,
      },
    },
    _id: {
      $nin: excludeDriverIds.map((id) => new mongoose.Types.ObjectId(id)),
    },
  })
    .select('_id fullName phoneNumber transporterProfile')
    .exec();

  return driver;
};

// ─── No-Driver Fallback ───────────────────────────────────────────────────────

/**
 * Called when no driver is found at the current radius step.
 * Attempts to advance to the next radius step within the tier's maxKm cap.
 * If no next step exists, flags the order AWAITING_DRIVER and alerts admin.
 */
export const handleNoDriverFound = async (
  jobData: DispatchJobData,
  order: IOrder
): Promise<void> => {
  const nextRadiusKm = getNextRadiusStep(
    jobData.vehicleClass,
    jobData.currentRadiusKm
  );

  if (nextRadiusKm !== null) {
    logger.warn(
      `No ${jobData.vehicleClass} drivers within ${jobData.currentRadiusKm}km ` +
      `for order ${jobData.orderId}. Expanding to ${nextRadiusKm}km ` +
      `(max: ${DISPATCH_RADIUS_TIERS[jobData.vehicleClass]?.maxKm}km).`
    );

    const expandedJobData: DispatchJobData = {
      ...jobData,
      currentRadiusKm: nextRadiusKm,
      attemptNumber: jobData.attemptNumber + 1,
      previousDriverId: undefined, // No driver to re-enable at this step
    };

    // Try immediately at expanded radius
    const driverAtExpanded = await findNearestAvailableDriver(
      jobData.pickupCoordinates,
      jobData.vehicleClass as VehicleClass,
      nextRadiusKm,
      jobData.excludeDriverIds
    );

    if (driverAtExpanded) {
      await offerToDriver(driverAtExpanded, expandedJobData, order);
    } else {
      // No driver at expanded radius either — enqueue worker to try next step
      await dispatchQueue.add(
        `dispatch:${jobData.orderId}:radius:${nextRadiusKm}`,
        expandedJobData,
        {
          delay: 0, // Immediate — no point waiting if no driver was found
          jobId: `dispatch:${jobData.orderId}:radius:${nextRadiusKm}`,
        }
      );
    }
    return;
  }

  // ── Hard cap reached — escalate to admin ─────────────────────────────────
  const tier = DISPATCH_RADIUS_TIERS[jobData.vehicleClass];
  logger.error(
    `[ALERT] Dispatch fully exhausted for order ${jobData.orderId}. ` +
    `VehicleClass: ${jobData.vehicleClass} | MaxRadius: ${tier?.maxKm}km | ` +
    `TotalAttempts: ${jobData.attemptNumber}.`
  );

  await Order.findByIdAndUpdate(jobData.orderId, {
    status: OrderStatus.AWAITING_DRIVER,
  });

  const io = getIO();
  io.of('/tracking').to('admin:alerts').emit('dispatch:exhausted', {
    orderId: jobData.orderId,
    vehicleClass: jobData.vehicleClass,
    maxRadiusReachedKm: tier?.maxKm,
    totalAttempts: jobData.attemptNumber,
    message: `No ${jobData.vehicleClass} driver found within ${tier?.maxKm}km. Manual dispatch required.`,
    alertedAt: new Date().toISOString(),
  });
};

// ─── Offer Mechanics ──────────────────────────────────────────────────────────

/**
 * Locks a driver as unavailable, records the attempt on the order,
 * enqueues the 15s timeout job, and emits the Socket.io offer.
 * Extracted as a shared helper used by both the service and the worker.
 */
export const offerToDriver = async (
  driver: typeof User.prototype,
  jobData: DispatchJobData,
  order: IOrder
): Promise<void> => {
  const offerExpiresAt = new Date(Date.now() + 15_000);

  // 1. Lock driver temporarily
  await User.findByIdAndUpdate(driver._id, {
    'transporterProfile.isAvailable': false,
  });

  // 2. Record dispatch attempt on order
  await Order.findByIdAndUpdate(jobData.orderId, {
    $push: {
      dispatchAttempts: {
        driverId: driver._id,
        vehicleClass: jobData.vehicleClass,
        offeredAt: new Date(),
        expiresAt: offerExpiresAt,
        wasAccepted: false,
        wasDeclined: false,
      },
    },
  });

  // 3. Enqueue 15s timeout job BEFORE emitting offer
  //    (guarantees cascade continues even if emit fails)
  const nextAttemptNumber = jobData.attemptNumber + 1;
  const timeoutJobData: DispatchJobData = {
    ...jobData,
    attemptNumber: nextAttemptNumber,
    excludeDriverIds: [...jobData.excludeDriverIds, driver._id.toString()],
    previousDriverId: driver._id.toString(),
  };

  await dispatchQueue.add(
    `dispatch:${jobData.orderId}:attempt:${nextAttemptNumber}`,
    timeoutJobData,
    {
      delay: 15_000,
      jobId: `dispatch:${jobData.orderId}:attempt:${nextAttemptNumber}`,
    }
  );

  // 4. Emit offer to driver via Socket.io
  const io = getIO();
  const offer: DispatchOffer = {
    orderId: jobData.orderId,
    commodity: order.commodity,
    quantityKg: order.quantityKg,
    pickupAddress: order.pickupLocation.address,
    deliveryAddress: order.deliveryLocation.address,
    distanceKm: order.distanceKm,
    transportFeeKes: Math.floor(order.transportFeeKes / 100),
    vehicleClass: jobData.vehicleClass,
    expiresAt: offerExpiresAt.getTime(),
  };

  io.of('/tracking').to(`driver:${driver._id}`).emit('dispatch:offer', offer);

  logger.info(
    `Dispatch offer | Order: ${jobData.orderId} | Driver: ${driver._id} ` +
    `| Radius: ${jobData.currentRadiusKm}km | Attempt: ${nextAttemptNumber} | Expires: 15s`
  );
};

// ─── Public Entry Points ──────────────────────────────────────────────────────

export const initiateDispatch = async (order: IOrder): Promise<void> => {
  const vehicleClass = resolveRequiredVehicleClass(order);
  const tier = DISPATCH_RADIUS_TIERS[vehicleClass];
  const initialRadius = tier.stepsKm[0];

  const initialJobData: DispatchJobData = {
    orderId: order._id.toString(),
    vehicleClass,
    pickupCoordinates: order.pickupLocation.coordinates,
    currentRadiusKm: initialRadius,
    attemptNumber: 1,
    excludeDriverIds: [],
  };

  const firstDriver = await findNearestAvailableDriver(
    order.pickupLocation.coordinates,
    vehicleClass as VehicleClass,
    initialRadius,
    []
  );

  if (firstDriver) {
    await offerToDriver(firstDriver, initialJobData, order);
  } else {
    await handleNoDriverFound(initialJobData, order);
  }

  logger.info(
    `Dispatch initiated | Order: ${order._id} | Class: ${vehicleClass} ` +
    `| InitialRadius: ${initialRadius}km | MaxRadius: ${tier.maxKm}km`
  );
};

export const acceptDispatch = async (
  orderId: string,
  driverId: string
): Promise<IOrder> => {
  const order = await Order.findById(orderId).exec();

  if (!order) {
    throw new AppError('Order not found.', 404, 'ORDER_NOT_FOUND');
  }

  if (order.status !== OrderStatus.AWAITING_DISPATCH) {
    throw new AppError(
      `Order no longer available. Status: ${order.status}`,
      409,
      'ORDER_NO_LONGER_AVAILABLE'
    );
  }

  const lastAttempt = order.dispatchAttempts[order.dispatchAttempts.length - 1];

  if (!lastAttempt || lastAttempt.driverId.toString() !== driverId) {
    throw new AppError(
      'This dispatch offer was not made to you.',
      403,
      'OFFER_MISMATCH'
    );
  }

  if (new Date() > lastAttempt.expiresAt) {
    throw new AppError('This dispatch offer has expired.', 410, 'OFFER_EXPIRED');
  }

  // Remove the pending BullMQ timeout job — driver accepted in time
  const attemptIndex = order.dispatchAttempts.length;
  const jobId = `dispatch:${orderId}:attempt:${attemptIndex + 1}`;
  const pendingJob = await dispatchQueue.getJob(jobId);
  if (pendingJob) await pendingJob.remove();

  const updatedOrder = await Order.findByIdAndUpdate(
    orderId,
    {
      assignedDriverId: new mongoose.Types.ObjectId(driverId),
      status: OrderStatus.DRIVER_ASSIGNED,
      dispatchedAt: new Date(),
      $set: {
        [`dispatchAttempts.${attemptIndex - 1}.wasAccepted`]: true,
      },
    },
    { new: true }
  ).exec();

  logger.info(`Order ${orderId} accepted by driver ${driverId}.`);
  return updatedOrder!;
};

export const declineDispatch = async (
  orderId: string,
  driverId: string
): Promise<void> => {
  const order = await Order.findById(orderId).exec();
  if (!order) return;

  const attemptIndex = order.dispatchAttempts.length - 1;

  await Order.findByIdAndUpdate(orderId, {
    $set: { [`dispatchAttempts.${attemptIndex}.wasDeclined`]: true },
  });

  // Re-enable driver immediately
  await User.findByIdAndUpdate(driverId, {
    'transporterProfile.isAvailable': true,
  });

  // Remove pending timeout job — cascade now, not after 15s
  const jobId = `dispatch:${orderId}:attempt:${order.dispatchAttempts.length + 1}`;
  const pendingJob = await dispatchQueue.getJob(jobId);
  if (pendingJob) await pendingJob.remove();

  logger.info(
    `Driver ${driverId} declined order ${orderId}. Cascading immediately.`
  );

  // Build next job data excluding this driver
  const nextJobData: DispatchJobData = {
    orderId,
    vehicleClass: order.dispatchAttempts[0]?.vehicleClass ?? VehicleClass.FRR_TRUCK,
    pickupCoordinates: order.pickupLocation.coordinates,
    currentRadiusKm: order.dispatchAttempts[0]
      ? DISPATCH_RADIUS_TIERS[order.dispatchAttempts[0].vehicleClass]?.stepsKm[0]
      : 20,
    attemptNumber: order.dispatchAttempts.length + 1,
    excludeDriverIds: order.dispatchAttempts.map((a) => a.driverId.toString()),
    previousDriverId: undefined,
  };

  const nextDriver = await findNearestAvailableDriver(
    nextJobData.pickupCoordinates,
    nextJobData.vehicleClass as VehicleClass,
    nextJobData.currentRadiusKm,
    nextJobData.excludeDriverIds
  );

  if (nextDriver) {
    await offerToDriver(nextDriver, nextJobData, order);
  } else {
    await handleNoDriverFound(nextJobData, order);
  }
};

export const reDispatchOrder = async (
  orderId: string,
  _vendorId: string
): Promise<void> => {
  const order = await Order.findByIdAndUpdate(
    orderId,
    { status: OrderStatus.AWAITING_DISPATCH },
    { new: true }
  ).exec();

  if (order) await initiateDispatch(order);
};

// ─── Vehicle Class Resolution ─────────────────────────────────────────────────

const resolveRequiredVehicleClass = (order: IOrder): string => {
  if (order.orderType === OrderType.B2C_LOCAL_MARKET) {
    return VehicleClass.BODA;
  }
  if (order.quantityKg <= 500) return VehicleClass.PICKUP;
  if (order.quantityKg <= 3000) return VehicleClass.CANTER;
  return VehicleClass.FRR_TRUCK;
};