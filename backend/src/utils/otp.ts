import crypto from 'crypto';

/**
 * Generates a cryptographically secure 4-digit numeric OTP.
 *
 * Uses crypto.randomInt (CSPRNG) — not Math.random().
 * Range: 1000–9999 (guarantees exactly 4 digits, no leading-zero ambiguity).
 *
 * Storage contract:
 *   - rawOtp  → sent via SMS to the driver / displayed in Transporter App
 *   - hashedOtp → stored in Order document (select: false on the otp field)
 *
 * Verification: hash the candidate OTP at verification time and compare
 * to the stored hash. The raw value is never persisted.
 */
export const generateOtp = (): { rawOtp: string; hashedOtp: string } => {
  const raw = crypto.randomInt(1000, 10000); // [1000, 9999]
  const rawOtp = raw.toString();
  const hashedOtp = crypto
    .createHash('sha256')
    .update(rawOtp)
    .digest('hex');

  return { rawOtp, hashedOtp };
};

/**
 * Verifies a candidate OTP against a stored hash.
 * Uses timingSafeEqual to prevent timing attacks.
 */
export const verifyOtp = (
  candidateOtp: string,
  storedHash: string
): boolean => {
  const candidateHash = crypto
    .createHash('sha256')
    .update(candidateOtp)
    .digest('hex');

  const candidateBuf = Buffer.from(candidateHash, 'hex');
  const storedBuf = Buffer.from(storedHash, 'hex');

  // Buffers must be equal length for timingSafeEqual
  if (candidateBuf.length !== storedBuf.length) return false;

  return crypto.timingSafeEqual(candidateBuf, storedBuf);
};

/**
 * Computes OTP expiry timestamp.
 * Loading OTP: 2 hours (driver has time to reach farm)
 * Delivery OTP: 4 hours (allows for transit delays)
 */
export const otpExpiresAt = (windowMinutes: number): Date => {
  return new Date(Date.now() + windowMinutes * 60 * 1000);
};