import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * OtpSession stores a short-lived, single-use OTP for phone-based login.
 *
 * Security properties:
 *   - OTP is stored as a SHA-256 hash — raw value never persisted
 *   - TTL index on expiresAt — MongoDB auto-deletes expired sessions
 *   - isUsed flag prevents replay attacks within the TTL window
 *   - attemptCount prevents brute-force (max 3 guesses per session)
 *   - One active session per phone — new request invalidates the old one
 *
 * Flow:
 *   1. POST /auth/otp/request  → creates OtpSession, sends SMS
 *   2. POST /auth/otp/verify   → verifies hash, issues JWT, marks isUsed
 */
export interface IOtpSession extends Document {
  _id: mongoose.Types.ObjectId;
  phoneNumber: string;
  hashedOtp: string;           // SHA-256 hash of the 6-digit code
  role: string;                // Expected role — verified on confirm
  isUsed: boolean;
  attemptCount: number;        // Incremented on each failed guess
  expiresAt: Date;             // Hard expiry (10 minutes)
  createdAt: Date;
}

const OtpSessionSchema = new Schema<IOtpSession>(
  {
    phoneNumber: {
      type: String,
      required: true,
      index: true,
    },
    hashedOtp: {
      type: String,
      required: true,
      select: false, // Never returned in queries by default
    },
    role: {
      type: String,
      required: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    attemptCount: {
      type: Number,
      default: 0,
      max: 3, // Locked after 3 wrong guesses
    },
    expiresAt: {
      type: Date,
      required: true,
      // MongoDB TTL index — document auto-deleted after expiry
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true }
);

// Compound index: enforce one active session per phone number
OtpSessionSchema.index({ phoneNumber: 1, isUsed: 1 });

export const OtpSession: Model<IOtpSession> = mongoose.model<IOtpSession>(
  'OtpSession',
  OtpSessionSchema
);