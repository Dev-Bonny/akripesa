import { Request, Response, NextFunction } from 'express';
import * as AuthService from './auth.service';
import { sendSuccess } from '../../utils/apiResponse';
import { env } from '../../config/env';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sets the refresh token.
 * BRANCHING POINT: If you chose Option A (HttpOnly cookie), the cookie setter
 * below is active. If Option B, we return the token in the response body instead.
 * 
 * Currently implementing Option A (HttpOnly cookie) as it was selected.
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