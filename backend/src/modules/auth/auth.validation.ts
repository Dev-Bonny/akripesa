import { z } from 'zod';
import { UserRole } from '../../models/User.model';

export const registerSchema = z.object({
  fullName: z.string().min(2).max(100).trim(),
  phoneNumber: z
    .string()
    .regex(/^2547\d{8}$/, 'Phone must be in format 2547XXXXXXXX'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  email: z.string().email().optional(),
  role: z
    .enum([
      UserRole.RETAIL_INVESTOR,
      UserRole.FARMER,
      UserRole.TRANSPORTER,
      UserRole.CONSUMER,
      UserRole.VENDOR,
      UserRole.BULK_BROKER,
    ])
    .optional(),
});

export const loginSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^2547\d{8}$/, 'Phone must be in format 2547XXXXXXXX'),
  password: z.string().min(1, 'Password is required'),
});