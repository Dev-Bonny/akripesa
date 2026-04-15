import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import * as AuthService from './auth.service';
import { sendSuccess, sendError } from '../../utils/apiResponse';
import { env } from '../../config/env';
import { User, UserRole } from '../../models/User.model';
import { AppError } from '../../middleware/errorHandler.middleware';
import { requestOtpSchema, verifyOtpSchema } from './auth.validation';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sets the refresh token.
 * BRANCHING POINT: If you chose Option A (HttpOnly cookie), the cookie setter
 * below is active. If Option B, we return the token in the response body instead.
 * * Currently implementing Option A (HttpOnly cookie) as it was selected.
 */
const setRefreshTokenCookie = (res: Response, refreshToken: string): void => {
  res.cookie('akripesa_refresh_token', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/api/v1/auth/refresh',    // Cookie only sent on the refresh endpoint
  });
};

const clearRefreshTokenCookie = (res: Response): void => {
  res.clearCookie('akripesa_refresh_token', {
    path: '/api/v1/auth/refresh',
  });
};

// ─── Controllers ─────────────────────────────────────────────────────────────

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await AuthService.registerUser(req.body);
    sendSuccess(res, 201, 'Account created successfully.', {
      userId: user._id,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      role: user.role,
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accessToken, refreshToken } = await AuthService.loginUser(req.body);
    setRefreshTokenCookie(res, refreshToken);
    sendSuccess(res, 200, 'Login successful.', { accessToken });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Read from HttpOnly cookie (Option A)
    const rawRefreshToken = req.cookies?.akripesa_refresh_token;

    if (!rawRefreshToken) {
      res.status(401).json({
        success: false,
        message: 'Refresh token missing.',
        code: 'NO_REFRESH_TOKEN',
      });
      return;
    }

    const { accessToken } = await AuthService.refreshAccessToken(rawRefreshToken);
    sendSuccess(res, 200, 'Token refreshed.', { accessToken });
  } catch (err) {
    next(err);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await AuthService.logoutUser(req.user!.userId);
    clearRefreshTokenCookie(res);
    sendSuccess(res, 200, 'Logged out successfully.', null);
  } catch (err) {
    next(err);
  }
};

export const googleLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new AppError('Google token is required', 400, 'MISSING_TOKEN');
    }

    // 1. Verify the token securely with Google
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new AppError('Invalid Google token payload', 400, 'INVALID_GOOGLE_TOKEN');
    }

    // 2. Find the user in your database by their Google email
    const user = await User.findOne({ email: payload.email });

    // 3. Admin Security Check! 
    if (!user) {
      throw new AppError('Access denied. No account found with this email.', 403, 'NOT_ADMIN');
    }
    
    // Check if the user has the required admin roles
    // Check if the user has the required admin roles
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.PLATFORM_SYSTEM) {
      throw new AppError('Access denied. Unauthorized role.', 403, 'NOT_ADMIN');
    }

    // 4. Generate your Akripesa JWT
    const accessToken = jwt.sign(
      { userId: user._id, role: user.role, phoneNumber: user.phoneNumber },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1d' } 
    );

    // 5. Return success using your existing helper
    sendSuccess(res, 200, 'Google login successful.', { 
      accessToken,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Token used too late')) {
        next(new AppError('Google token expired', 401, 'TOKEN_EXPIRED'));
    } else {
        next(err);
    }
  }
};
/**
 * POST /api/v1/auth/otp/request
 *
 * Step 1 of OTP login for operational users (Transporter, Farmer, Vendor).
 * Validates phone + role, generates OTP, sends SMS via Africa's Talking.
 *
 * Always returns 200 to prevent phone number enumeration.
 * The response message is intentionally identical whether the phone
 * exists or not.
 */
export const requestOtpController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Validate request body
  const parsed = requestOtpSchema.safeParse(req.body);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten()
      .fieldErrors as Record<string, string[]>;
    sendError(res, 422, 'Validation failed.', {
      errors: fieldErrors,
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  try {
    await AuthService.requestOtp(parsed.data);
  } catch (err: any) {
    // If the AppError has a 200 code (enumeration prevention),
    // return 200 regardless — do not forward to error handler
    if (err?.statusCode === 200) {
      sendSuccess(
        res,
        200,
        'If this number is registered, a verification code has been sent.',
        null
      );
      return;
    }
    next(err);
    return;
  }

  sendSuccess(
    res,
    200,
    'Verification code sent. Please check your phone.',
    null
  );
};

/**
 * POST /api/v1/auth/otp/verify
 *
 * Step 2 of OTP login. Verifies the 6-digit code and issues JWT tokens.
 * Refresh token is set as an HttpOnly cookie (same pattern as password login).
 */
export const verifyOtpController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const parsed = verifyOtpSchema.safeParse(req.body);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten()
      .fieldErrors as Record<string, string[]>;
    sendError(res, 422, 'Validation failed.', {
      errors: fieldErrors,
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  try {
    const { accessToken, refreshToken } =
      await AuthService.verifyOtp(parsed.data);

    // Set refresh token as HttpOnly cookie (consistent with password login)
    res.cookie('akripesa_refresh_token', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   7 * 24 * 60 * 60 * 1000,
      path:     '/api/v1/auth/refresh',
    });

    sendSuccess(res, 200, 'Login successful.', { accessToken });
  } catch (err) {
    next(err);
  }
};