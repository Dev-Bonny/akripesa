import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { socketAuthMiddleware } from './socket.auth.middleware';
import { registerTrackingNamespace } from './namespaces/tracking.namespace';
import { registerInvestorNamespace } from './namespaces/investor.namespace';
import { registerVendorNamespace } from './namespaces/vendor.namespace';
import { logger } from '../utils/logger';

let io: Server | null = null;

export const initializeSocketServer = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin:
        env.NODE_ENV === 'production'
          ? ['https://admin.akripesa.com', 'https://app.akripesa.com']
          : 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    // Prevent unauthenticated polling — require upgrade to WebSocket
    transports: ['websocket'],
    // Disconnect clients that fail to authenticate within 10s
    connectTimeout: 10_000,
    pingTimeout: 20_000,
    pingInterval: 25_000,
  });

  // ── Global Auth Middleware ────────────────────────────────────────────────
  // Applied to ALL namespaces before any connection is established.
  io.use(async (socket: Socket, next) => {
    await socketAuthMiddleware(socket, next);
  });

  // ── Register Namespaces ───────────────────────────────────────────────────
  registerTrackingNamespace(io);
  registerInvestorNamespace(io);
  registerVendorNamespace(io);

  io.on('connection', (socket: Socket) => {
    // Root namespace connection — no business logic here
    // All real logic lives in the named namespaces above
    logger.debug(`[/] Root socket connected | ID: ${socket.id}`);

    socket.on('disconnect', () => {
      logger.debug(`[/] Root socket disconnected | ID: ${socket.id}`);
    });
  });

  logger.info('✅ Socket.io server initialized with /tracking, /investor, /vendor namespaces.');
  return io;
};

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.io server not initialized.');
  return io;
};