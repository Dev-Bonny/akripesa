import http from 'http';
import app from './src/app';
import { connectDB } from './src/config/db';
import { env } from './src/config/env';
import { logger } from './src/utils/logger';
import { initializeSocketServer } from './src/sockets';
import { payoutWorker } from './src/jobs/payout.worker';
import { deadLetterWorker } from './src/jobs/deadLetter.worker';
import { dispatchWorker } from './src/jobs/dispatch.worker';

const server = http.createServer(app);

const bootstrap = async (): Promise<void> => {
  await connectDB();

  // Initialize Socket.io (must attach to http.Server, not Express app)
  initializeSocketServer(server);

  logger.info('✅ Payout worker running.');
  logger.info('✅ Dead-letter worker running.');
  logger.info('✅ Dispatch worker running.');

  server.listen(env.PORT, () => {
    logger.info(`🚀 Akripesa API running on port ${env.PORT} [${env.NODE_ENV}]`);
  });
};

const shutdown = async (signal: string): Promise<void> => {
  logger.warn(`${signal} received. Shutting down gracefully...`);

  await Promise.all([
    payoutWorker.close(),
    deadLetterWorker.close(),
    dispatchWorker.close(),
  ]);

  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
  shutdown('UNHANDLED_REJECTION');
});

bootstrap();