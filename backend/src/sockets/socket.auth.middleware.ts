import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../models/User.model';
import { SocketUser } from './socket.types';
import { consumeSocketToken } from '../modules/socketToken/socketToken.service';
import { AccessTokenPayload } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

/**
 * Socket.io authentication middleware.
 *
 * Supports two auth strategies on the same handshake:
 *
 * Strategy 1 — Socket Token (mobile PWA / Transporter App):
 *   Client passes ?token=<socketToken> in the WS connection URL.
 *   Token is verified against Redis and consumed (single-use).
 *
 * Strategy 2 — HttpOnly Cookie JWT (web dashboards):
 *   Client's browser sends the accessToken cookie automatically.
 *   JWT is verified against JWT_ACCESS_SECRET.
 *
 * Both strategies populate socket.data.user with a SocketUser object,
 * which all namespace/room guards use for authorization decisions.
 */
export const socketAuthMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> => {
  try {
    // ── Strategy 1: Socket token (mobile PWA) ────────────────────────────────
    const socketToken = socket.handshake.query?.token as string | undefined;

    if (socketToken) {
      const user = await consumeSocketToken(socketToken);

      if (!user) {
        logger.warn(
          `Socket auth rejected: invalid/expired socket token | ID: ${socket.id}`
        );
        return next(new Error('SOCKET_TOKEN_INVALID'));
      }

      socket.data.user = user;
      logger.debug(
        `Socket authenticated via token | User: ${user.userId} | Role: ${user.role}`
      );
      return next();
    }

    // ── Strategy 2: HttpOnly cookie JWT (web clients) ────────────────────────
    const cookieHeader = socket.handshake.headers.cookie ?? '';
    const accessTokenMatch = cookieHeader.match(
      /(?:^|;\s*)akripesa_access_token=([^;]+)/
    );

    // Also support Authorization header as fallback
    const authHeader = socket.handshake.headers.authorization ?? '';
    const bearerToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    const jwtToken = accessTokenMatch?.[1] ?? bearerToken;

    if (!jwtToken) {
      logger.warn(
        `Socket auth rejected: no credentials provided | ID: ${socket.id}`
      );
      return next(new Error('NO_SOCKET_CREDENTIALS'));
    }

    const decoded = jwt.verify(
      jwtToken,
      env.JWT_ACCESS_SECRET
    ) as AccessTokenPayload;

    socket.data.user = {
      userId: decoded.userId,
      role: decoded.role,
      phoneNumber: decoded.phoneNumber,
    } satisfies SocketUser;

    logger.debug(
      `Socket authenticated via JWT | User: ${decoded.userId} | Role: ${decoded.role}`
    );
    return next();
  } catch (err) {
    if (err instanceof Error) {
      logger.warn(`Socket auth error: ${err.message} | ID: ${socket.id}`);
      return next(new Error('SOCKET_AUTH_FAILED'));
    }
    return next(new Error('SOCKET_AUTH_FAILED'));
  }
};

// ─── Room Authorization Guards ────────────────────────────────────────────────

/**
 * Verifies a socket user may join a tracking room for a given order.
 * Only the assigned driver, the buyer, and admins are permitted.
 *
 * Called inside the tracking namespace BEFORE joining the room.
 */
export const canJoinTrackingRoom = (
  socketUser: SocketUser,
  orderAssignedDriverId: string,
  orderBuyerId: string
): boolean => {
  if (socketUser.role === UserRole.SUPER_ADMIN) return true;
  if (socketUser.userId === orderAssignedDriverId) return true;
  if (socketUser.userId === orderBuyerId) return true;
  return false;
};