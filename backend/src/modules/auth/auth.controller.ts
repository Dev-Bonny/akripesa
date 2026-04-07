import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import * as AuthService from './auth.service';
import { sendSuccess } from '../../utils/apiResponse';
import { env } from '../../config/env';
import { User, UserRole } from '../../models/User.model';
import { AppError } from '../../middleware/errorHandler.middleware';

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