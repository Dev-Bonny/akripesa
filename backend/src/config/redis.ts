import { Redis } from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

// BullMQ requires two separate Redis connections:
// one for the queue client, one for the blocking worker subscriber.
const createRedisConnection = (label: string): Redis => {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
  });

  client.on('connect', () => logger.info(`Redis [${label}] connected.`));
  client.on('error', (err) => logger.error(`Redis [${label}] error:`, err));
  client.on('close', () => logger.warn(`Redis [${label}] connection closed.`));

  return client;
};

export const redisConnection = createRedisConnection('main');
export const redisSubscriberConnection = createRedisConnection('subscriber');