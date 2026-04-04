import { Namespace, Server, Socket } from 'socket.io';
import { Order, OrderStatus } from '../../models/Order.model';
import { User } from '../../models/User.model';
import { canJoinTrackingRoom } from '../socket.auth.middleware';
import { SocketUser, DriverLocationUpdate, TrackingRoomUpdate } from '../socket.types';
import { logger } from '../../utils/logger';

/**
 * /tracking namespace
 *
 * Room structure: `order:<orderId>`
 * Only the assigned driver (emits location) and the buyer/admin (receive) join.
 *
 * Events (server → client):
 *   tracking:update  — live driver GPS coordinates
 *   tracking:arrived — driver confirmed at pickup or delivery
 *
 * Events (client → server):
 *   location:update  — driver sends GPS coords (drivers only)
 *   room:join        — buyer/admin requests to join order tracking room
 */
export const registerTrackingNamespace = (io: Server): void => {
  const tracking: Namespace = io.of('/tracking');

  // Auth middleware already applied globally in sockets/index.ts
  tracking.on('connection', (socket: Socket) => {
    const user = socket.data.user as SocketUser;
    logger.debug(`[/tracking] Connected | User: ${user.userId} | Socket: ${socket.id}`);

    // ── Driver: join their active order room automatically ────────────────────
    socket.on('room:join', async (payload: { orderId: string }) => {
      try {
        const order = await Order.findById(payload.orderId)
          .select('assignedDriverId buyerId status')
          .lean()
          .exec();

        if (!order) {
          socket.emit('error', { message: 'Order not found.', code: 'ORDER_NOT_FOUND' });
          return;
        }

        const inTransitStatuses = [
          OrderStatus.DRIVER_ASSIGNED,
          OrderStatus.IN_TRANSIT,
          OrderStatus.VENDOR_PREPPING,
        ];

        if (!inTransitStatuses.includes(order.status)) {
          socket.emit('error', {
            message: 'Order is not currently in transit.',
            code: 'ORDER_NOT_IN_TRANSIT',
          });
          return;
        }

        const authorized = canJoinTrackingRoom(
          user,
          order.assignedDriverId?.toString() ?? '',
          order.buyerId.toString()
        );

        if (!authorized) {
          socket.emit('error', {
            message: 'You are not authorized to track this order.',
            code: 'TRACKING_FORBIDDEN',
          });
          return;
        }

        const roomName = `order:${payload.orderId}`;
        await socket.join(roomName);

        logger.info(
          `[/tracking] User ${user.userId} (${user.role}) joined room ${roomName}`
        );

        socket.emit('room:joined', { orderId: payload.orderId, roomName });
      } catch (err) {
        logger.error('[/tracking] room:join error:', err);
        socket.emit('error', { message: 'Failed to join tracking room.', code: 'JOIN_FAILED' });
      }
    });

    // ── Driver: broadcast location update to room ─────────────────────────────
    socket.on('location:update', async (payload: DriverLocationUpdate) => {
      try {
        // Only drivers may emit location updates
        const { UserRole } = await import('../../models/User.model');
        if (user.role !== UserRole.TRANSPORTER) {
          socket.emit('error', {
            message: 'Only drivers may emit location updates.',
            code: 'LOCATION_FORBIDDEN',
          });
          return;
        }

        const order = await Order.findById(payload.orderId)
          .select('assignedDriverId status')
          .lean()
          .exec();

        if (!order || order.assignedDriverId?.toString() !== user.userId) {
          socket.emit('error', {
            message: 'You are not the assigned driver for this order.',
            code: 'DRIVER_MISMATCH',
          });
          return;
        }

        // Persist latest driver location to User document for geo queries
        await User.findByIdAndUpdate(user.userId, {
          'transporterProfile.currentLocation': {
            type: 'Point',
            coordinates: [payload.longitude, payload.latitude],
          },
        });

        const driver = await User.findById(user.userId)
          .select('fullName transporterProfile.vehicleClass')
          .lean()
          .exec();

        const update: TrackingRoomUpdate = {
          ...payload,
          driverName: driver?.fullName ?? 'Driver',
          vehicleClass: driver?.transporterProfile?.vehicleClass ?? 'UNKNOWN',
        };

        const roomName = `order:${payload.orderId}`;

        // Broadcast to all room members except the emitting driver
        socket.to(roomName).emit('tracking:update', update);
      } catch (err) {
        logger.error('[/tracking] location:update error:', err);
      }
    });

    socket.on('disconnect', (reason) => {
      logger.debug(
        `[/tracking] Disconnected | User: ${user.userId} | Reason: ${reason}`
      );
    });
  });
};