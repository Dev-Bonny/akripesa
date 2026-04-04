import { Namespace, Server, Socket } from 'socket.io';
import { UserRole } from '../../models/User.model';
import { SocketUser, FundingProgressUpdate } from '../socket.types';
import { logger } from '../../utils/logger';

/**
 * /investor namespace
 *
 * Room structure: `campaign:<campaignId>`
 * Any authenticated RETAIL_INVESTOR, BULK_BROKER, or SUPER_ADMIN may join.
 *
 * Events (server → client):
 *   funding:update — live funding progress bar update
 *
 * Emission trigger: called from escrow.service.ts after each STK confirmation.
 * The emitter is exported so escrow can call it without coupling to Socket.io internals.
 */

let investorNamespace: Namespace | null = null;

export const registerInvestorNamespace = (io: Server): void => {
  investorNamespace = io.of('/investor');

  investorNamespace.on('connection', (socket: Socket) => {
    const user = socket.data.user as SocketUser;

    const allowedRoles: UserRole[] = [
      UserRole.RETAIL_INVESTOR,
      UserRole.BULK_BROKER,
      UserRole.SUPER_ADMIN,
    ];

    if (!allowedRoles.includes(user.role)) {
      logger.warn(
        `[/investor] Unauthorized role ${user.role} attempted connection. Disconnecting.`
      );
      socket.disconnect(true);
      return;
    }

    logger.debug(`[/investor] Connected | User: ${user.userId}`);

    socket.on('campaign:subscribe', async (payload: { campaignId: string }) => {
      const roomName = `campaign:${payload.campaignId}`;
      await socket.join(roomName);
      logger.debug(
        `[/investor] User ${user.userId} subscribed to ${roomName}`
      );
      socket.emit('campaign:subscribed', { campaignId: payload.campaignId });
    });

    socket.on('campaign:unsubscribe', async (payload: { campaignId: string }) => {
      await socket.leave(`campaign:${payload.campaignId}`);
    });

    socket.on('disconnect', () => {
      logger.debug(`[/investor] Disconnected | User: ${user.userId}`);
    });
  });
};

/**
 * Emits a funding progress update to all subscribers of a campaign room.
 * Called externally by escrow.service.ts after each STK confirmation.
 */
export const emitFundingProgress = (update: FundingProgressUpdate): void => {
  if (!investorNamespace) {
    logger.warn('[/investor] Namespace not initialized. Cannot emit funding update.');
    return;
  }
  investorNamespace
    .to(`campaign:${update.campaignId}`)
    .emit('funding:update', update);
};