import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole, IUser } from '../models/User.model';
import { AppError } from './errorHandler.middleware';

// Augment Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: UserRole;
        phoneNumber: string;
      };
    }
  }
}

export interface AccessTokenPayload {
  userId: string;
  role: UserRole;
  phoneNumber: string;
}

/**
 * Verifies the JWT access token.
 * Token is expected in: Authorization: Bearer <token>
 *
 * NOTE: If you choose Option A (HttpOnly cookie), swap the
 * token extraction line to: req.cookies?.accessToken
 * The verification logic below is identical for both strategies.
 */
export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('Authentication token missing.', 401, 'NO_TOKEN'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(
      token,
      env.JWT_ACCESS_SECRET
    ) as AccessTokenPayload;

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      phoneNumber: decoded.phoneNumber,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AppError('Access token expired.', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Invalid access token.', 401, 'TOKEN_INVALID'));
  }
};

/**
 * Role-based access control guard.
 * Usage: router.get('/admin', authenticate, authorize(UserRole.SUPER_ADMIN), handler)
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Not authenticated.', 401, 'NOT_AUTHENTICATED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          'You do not have permission to perform this action.',
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
};