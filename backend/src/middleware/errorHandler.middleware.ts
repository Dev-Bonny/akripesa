import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { sendError } from '../utils/apiResponse';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // Distinguishes known errors from bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Known operational error (thrown intentionally by our services)
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.message, { code: err.code });
    return;
  }

  // Mongoose duplicate key (e.g., duplicate phone number on registration)
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue || {})[0] ?? 'field';
    sendError(res, 409, `${field} already exists.`, { code: 'DUPLICATE_KEY' });
    return;
  }

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.fromEntries(
      Object.entries(err.errors).map(([key, val]) => [key, [val.message]])
    );
    sendError(res, 422, 'Validation failed.', { errors, code: 'VALIDATION_ERROR' });
    return;
  }

  // Mongoose cast error (e.g., invalid ObjectId in URL param)
  if (err instanceof mongoose.Error.CastError) {
    sendError(res, 400, `Invalid value for field: ${err.path}`, {
      code: 'CAST_ERROR',
    });
    return;
  }

  // Unknown / programmer error — log full stack, return generic message
  logger.error('Unhandled error:', err);
  sendError(res, 500, 'An unexpected internal error occurred.', {
    code: 'INTERNAL_SERVER_ERROR',
  });
};