import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  REDIS_URL: z.string(),
  DARAJA_CONSUMER_KEY: z.string(),
  DARAJA_CONSUMER_SECRET: z.string(),
  DARAJA_PASSKEY: z.string(),
  DARAJA_SHORTCODE: z.string(),
  DARAJA_B2C_INITIATOR_NAME: z.string(),
  DARAJA_B2C_SECURITY_CREDENTIAL: z.string(),
  DARAJA_ENVIRONMENT: z.enum(['sandbox', 'production']),
  
  API_BASE_URL: z.string().url(),
  DARAJA_CALLBACK_SECRET: z.string(),

  AFRICAS_TALKING_API_KEY: z.string(),
  AFRICAS_TALKING_USERNAME: z.string(),
  BANK_API_BASE_URL: z.string().url(),
  BANK_API_KEY: z.string(),
  PLATFORM_SYSTEM_USER_ID: z.string(), 
  
  // ---> ADDED GOOGLE OAUTH VARIABLES HERE <---
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;