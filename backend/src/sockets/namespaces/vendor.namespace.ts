import { Namespace, Server, Socket } from 'socket.io';
import { UserRole } from '../../models/User.model';
import { SocketUser, VendorOrderPing } from '../socket.types';
import { logger } from '../../utils/logger';

let vendorNamespace: Namespace | null = null;

/**
 * /vendor namespace
 *
 * Room structure: `vendor:<vendorId>`
 * Each vendor joins their own private room on connection.
 *
 * Events (server → client):
 *   order:ping    — new B2C order requires vendor confirmation
 *   order:expired — order timed out without vendor response
 *
 * Events (client → server):
 *   order:accept  — vendor confirms they will pack the order
 *   order:decline — vendor cannot fulfill (triggers re-dispatch to next vendor)
 */
export const registerVendorNamespace = (io: Server): void => {
  vendorNamespace = io.of('/vendor');

  vendorNamespace.on('connection', (socket: Socket) => {
    const user = socket.data.user as SocketUser;

    if (user.role !== UserRole.VENDOR) {
      logger.warn(
        `[/vendor] Non-vendor role ${user.role} attempted connection. Disconnecting.`
      );
      socket.disconnect(true);
      return;
    }

    // Each vendor auto-joins their private room
    const vendorRoom = `vendor:${user.userId}`;
    socket.join(vendorRoom);
    logger.debug(`[/vendor] Vendor ${user.userId} joined room ${vendorRoom}`);

    socket.on('order:accept', async (payload: { orderId: string; estimatedPrepMinutes: number }) => {
      try {
        const { Order, OrderStatus } = await import('../../models/Order.model');
        await Order.findByIdAndUpdate(payload.orderId, {
          status: OrderStatus.VENDOR_PREPPING,
        });
        socket.emit('order:accepted', { orderId: payload.orderId });
        logger.info(
          `[/vendor] Order ${payload.orderId} accepted by vendor ${user.userId}`
        );
      } catch (err) {
        logger.error('[/vendor] order:accept error:', err);
        socket.emit('error', { message: 'Failed to accept order.', code: 'ACCEPT_FAILED' });
      }
    });

    socket.on('order:decline', async (payload: { orderId: string }) => {
      try {
        // Trigger re-dispatch logic (Sprint 4 dispatch service)
        const { reDispatchOrder } = await import('../modules/dispatch/dispatch.service');
        await reDispatchOrder(payload.orderId, user.userId);
        socket.emit('order:declined', { orderId: payload.orderId });
      } catch (err) {
        logger.error('[/vendor] order:decline error:', err);
      }
    });

    socket.on('disconnect', () => {
      logger.debug(`[/vendor] Disconnected | Vendor: ${user.userId}`);
    });
  });
};

/**
 * Pings a specific vendor with a new order.
 * Called externally by the order creation service.
 */
export const pingVendor = (vendorId: string, ping: VendorOrderPing): void => {
  if (!vendorNamespace) {
    logger.warn('[/vendor] Namespace not initialized. Cannot ping vendor.');
    return;
  }
  vendorNamespace.to(`vendor:${vendorId}`).emit('order:ping', ping);
  logger.info(`[/vendor] Order ping sent to vendor ${vendorId} for order ${ping.orderId}`);
};