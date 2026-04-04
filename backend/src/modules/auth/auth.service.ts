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
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    issuer: 'akripesa-api',
    audience: 'akripesa-clients',
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