import { OtpSession } from '../../models/OtpSession.model';
import { atClient } from '../africastalking/at.client';
import { RequestOtpDto, VerifyOtpDto } from './auth.validation';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User, IUser, UserRole } from '../../models/User.model';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler.middleware';
import { AccessTokenPayload } from '../../middleware/auth.middleware';
import { logger } from '../../utils/logger';

// ─── Token Generation ─────────────────────────────────────────────────────────

export const generateAccessToken = (user: IUser): string => {
  const payload: AccessTokenPayload = {
    userId: user._id.toString(),
    role: user.role,
    phoneNumber: user.phoneNumber,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
  expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
});
};

export const generateRefreshToken = (): {
  rawToken: string;
  hashedToken: string;
} => {
  // Cryptographically secure random token — not JWT
  // Stored as a hash in the DB; raw value sent to client only once
  const rawToken = crypto.randomBytes(64).toString('hex');
  const hashedToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');
  return { rawToken, hashedToken };
};

// ─── Registration ─────────────────────────────────────────────────────────────

interface RegisterDTO {
  fullName: string;
  phoneNumber: string;
  password: string;
  role?: UserRole;
  email?: string;
}

export const registerUser = async (dto: RegisterDTO): Promise<IUser> => {
  const existingUser = await User.findOne({ phoneNumber: dto.phoneNumber });
  if (existingUser) {
    throw new AppError(
      'An account with this phone number already exists.',
      409,
      'PHONE_ALREADY_EXISTS'
    );
  }

  const user = new User({
    fullName: dto.fullName,
    phoneNumber: dto.phoneNumber,
    passwordHash: dto.password, // Pre-save hook will hash this
    role: dto.role ?? UserRole.RETAIL_INVESTOR,
    email: dto.email,
    mpesaWallet: {
      phoneNumber: dto.phoneNumber,
      totalDeposited: 0,
      totalWithdrawn: 0,
      currentBalance: 0,
    },
  });

  await user.save();
  logger.info(`New user registered: ${user.phoneNumber} [${user.role}]`);
  return user;
};

// ─── Login ────────────────────────────────────────────────────────────────────

interface LoginDTO {
  phoneNumber: string;
  password: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export const loginUser = async (dto: LoginDTO): Promise<AuthTokens> => {
  // Explicitly select passwordHash — it is select:false by default
  const user = await User.findOne({ phoneNumber: dto.phoneNumber })
    .select('+passwordHash')
    .exec();

  if (!user || !user.isActive) {
    // Consistent timing: always run bcrypt compare to prevent user enumeration
    await bcrypt.compare(dto.password, '$2b$12$invalidhashfortimingnormalization');
    throw new AppError('Invalid phone number or password.', 401, 'INVALID_CREDENTIALS');
  }

  const isMatch = await user.comparePassword(dto.password);
  if (!isMatch) {
    throw new AppError('Invalid phone number or password.', 401, 'INVALID_CREDENTIALS');
  }

  const accessToken = generateAccessToken(user);
  const { rawToken, hashedToken } = generateRefreshToken();

  // Store hashed refresh token on the user document
  user.refreshTokenHash = hashedToken;
  user.lastLoginAt = new Date();
  await user.save();

  logger.info(`User logged in: ${user.phoneNumber}`);
  return { accessToken, refreshToken: rawToken };
};

// ─── Token Refresh ────────────────────────────────────────────────────────────

export const refreshAccessToken = async (
  rawRefreshToken: string
): Promise<{ accessToken: string }> => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(rawRefreshToken)
    .digest('hex');

  // Select refreshTokenHash — it is select:false by default
  const user = await User.findOne({ refreshTokenHash: hashedToken })
    .select('+refreshTokenHash')
    .exec();

  if (!user || !user.isActive) {
    throw new AppError(
      'Invalid or expired refresh token.',
      401,
      'INVALID_REFRESH_TOKEN'
    );
  }

  const accessToken = generateAccessToken(user);
  logger.info(`Access token refreshed for: ${user.phoneNumber}`);
  return { accessToken };
};

// ─── Logout ───────────────────────────────────────────────────────────────────

export const logoutUser = async (userId: string): Promise<void> => {
  // Invalidate the refresh token by clearing it from the DB
  await User.findByIdAndUpdate(userId, {
    $unset: { refreshTokenHash: '' },
  });
  logger.info(`User logged out: ${userId}`);
};

const OTP_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 3;

/**
 * Generates a cryptographically secure 6-digit OTP.
 * Uses crypto.randomInt (CSPRNG) — not Math.random().
 */
const generateSixDigitOtp = (): { rawOtp: string; hashedOtp: string } => {
  const raw       = crypto.randomInt(100000, 1000000); // [100000, 999999]
  const rawOtp    = raw.toString();
  const hashedOtp = crypto
    .createHash('sha256')
    .update(rawOtp)
    .digest('hex');
  return { rawOtp, hashedOtp };
};

/**
 * Step 1 — Request OTP.
 *
 * Validates that the user exists with the correct role, generates a
 * 6-digit OTP, stores the hash in OtpSession, and sends SMS.
 *
 * Rate limiting: if an unexpired, unused session already exists for
 * this phone, we invalidate it and issue a fresh one. This prevents
 * OTP farming while allowing legitimate re-requests.
 */
export const requestOtp = async (dto: RequestOtpDto): Promise<void> => {
  // 1. Verify user exists with the claimed role
  const user = await User.findOne({
    phoneNumber: dto.phoneNumber,
    role:        dto.role,
    isActive:    true,
  }).exec();

  if (!user) {
    // Return generic message — do not reveal whether phone exists
    throw new AppError(
      'If this number is registered, an OTP will be sent.',
      200, // Intentional 200 — prevents phone enumeration
      'OTP_REQUESTED'
    );
  }

  // 2. Invalidate any existing active OTP session for this phone
  await OtpSession.updateMany(
    { phoneNumber: dto.phoneNumber, isUsed: false },
    { isUsed: true }
  );

  // 3. Generate OTP
  const { rawOtp, hashedOtp } = generateSixDigitOtp();

  // 4. Persist hashed OTP session
  await OtpSession.create({
    phoneNumber: dto.phoneNumber,
    hashedOtp,
    role:        dto.role,
    isUsed:      false,
    attemptCount: 0,
    expiresAt:   new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
  });

  // 5. Send SMS (stubbed in development)
  await atClient.sendOtp(dto.phoneNumber, rawOtp);

  logger.info(
    `OTP requested | Phone: ${dto.phoneNumber} | Role: ${dto.role}`
  );
  // rawOtp goes out of scope here — never returned or stored in plaintext
};

/**
 * Step 2 — Verify OTP and issue JWT.
 *
 * Validates the candidate OTP against the stored hash using
 * timingSafeEqual. Issues access + refresh tokens on success.
 */
export const verifyOtp = async (
  dto: VerifyOtpDto
): Promise<AuthTokens> => {
  // 1. Find the most recent active session for this phone
  const session = await OtpSession.findOne({
    phoneNumber: dto.phoneNumber,
    isUsed:      false,
    expiresAt:   { $gt: new Date() },
  })
    .select('+hashedOtp')
    .sort({ createdAt: -1 })
    .exec();

  if (!session) {
    throw new AppError(
      'OTP has expired or does not exist. Please request a new code.',
      401,
      'OTP_EXPIRED'
    );
  }

  // 2. Check attempt count before comparing (prevents timing oracle)
  if (session.attemptCount >= MAX_OTP_ATTEMPTS) {
    await OtpSession.findByIdAndUpdate(session._id, { isUsed: true });
    throw new AppError(
      'Too many incorrect attempts. Please request a new OTP.',
      429,
      'OTP_ATTEMPTS_EXCEEDED'
    );
  }

  // 3. Hash candidate and compare using timingSafeEqual
  const candidateHash = crypto
    .createHash('sha256')
    .update(dto.otp)
    .digest('hex');

  const candidateBuf = Buffer.from(candidateHash, 'hex');
  const storedBuf    = Buffer.from(session.hashedOtp, 'hex');

  const isValid =
    candidateBuf.length === storedBuf.length &&
    crypto.timingSafeEqual(candidateBuf, storedBuf);

  if (!isValid) {
    // Increment attempt count
    await OtpSession.findByIdAndUpdate(session._id, {
      $inc: { attemptCount: 1 },
    });

    const remaining = MAX_OTP_ATTEMPTS - (session.attemptCount + 1);
    throw new AppError(
      `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      401,
      'OTP_INVALID'
    );
  }

  // 4. Mark session as used (single-use enforcement)
  await OtpSession.findByIdAndUpdate(session._id, { isUsed: true });

  // 5. Fetch user and issue JWT tokens
  const user = await User.findOne({ phoneNumber: dto.phoneNumber }).exec();

  if (!user || !user.isActive) {
    throw new AppError('Account not found or inactive.', 404, 'USER_NOT_FOUND');
  }

  const accessToken                  = generateAccessToken(user);
  const { rawToken, hashedToken }    = generateRefreshToken();

  user.refreshTokenHash = hashedToken;
  user.lastLoginAt      = new Date();
  await user.save();

  logger.info(
    `OTP verified — JWT issued | Phone: ${dto.phoneNumber} | Role: ${user.role}`
  );

  return { accessToken, refreshToken: rawToken };
};