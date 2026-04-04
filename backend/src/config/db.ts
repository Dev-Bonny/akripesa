import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

export const connectDB = async (attempt = 1): Promise<void> => {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      // Recommended production settings
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info('✅ MongoDB connected successfully');

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });
  } catch (error) {
    logger.error(`MongoDB connection attempt ${attempt} failed:`, error);
    if (attempt < MAX_RETRIES) {
      logger.info(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
      return connectDB(attempt + 1);
    }
    logger.error('Max MongoDB connection retries reached. Exiting.');
    process.exit(1);
  }
};