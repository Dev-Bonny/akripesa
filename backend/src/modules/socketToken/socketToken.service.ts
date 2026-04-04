import crypto from 'crypto';
import { redisConnection } from '../../config/redis';
import { IUser } from '../../models/User.model';
import { SocketUser } from '../../sockets/socket.types';

const SOCKET_TOKEN_TTL_SECONDS = 60; // Token valid for 60s — used once at WS handshake
const SOCKET_TOKEN_PREFIX = 'socket_token:';

/**
 * Issues a short-lived, single-use socket token.
 *
 * Flow:
 *   1. Client calls POST /api/v1/socket-token (authenticated via JWT)
 *   2. Server generates a 32-byte random token
 *   3. Token → Redis with 60s TTL, keyed to userId + role
 *   4. Client uses token as ?token= query param on WS handshake
 *   5. Socket auth middleware verifies token against Redis, then deletes it
 *
 * This decouples WebSocket auth from the HttpOnly cookie (which cannot
 * be read by JS on mobile PWA clients) and from passing the JWT as a
 * URL query param (which leaks into server access logs).
 */
export const issueSocketToken = async (user: IUser): Promise<string> => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const key = `${SOCKET_TOKEN_PREFIX}${rawToken}`;

  const payload: SocketUser = {
    userId: user._id.toString(),
    role: user.role,
    phoneNumber: user.phoneNumber,
  };

  await redisConnection.set(
    key,
    JSON.stringify(payload),
    'EX',
    SOCKET_TOKEN_TTL_SECONDS
  );

  return rawToken;
};

/**
 * Verifies and consumes a socket token (single-use).
 * Returns the SocketUser payload if valid, null if expired or invalid.
 */
export const consumeSocketToken = async (
  rawToken: string
): Promise<SocketUser | null> => {
  const key = `${SOCKET_TOKEN_PREFIX}${rawToken}`;

  // Atomic GET + DEL — token is consumed on first use
  const [payload] = await redisConnection
    .pipeline()
    .get(key)
    .del(key)
    .exec() as [Error | null, string | null][];

  if (!payload || typeof payload !== 'string') return null;

  try {
    return JSON.parse(payload) as SocketUser;
  } catch {
    return null;
  }
};