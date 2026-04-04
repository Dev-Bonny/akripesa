import { Response } from 'express';

interface SuccessPayload<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>; // pagination, counts, etc.
}

interface ErrorPayload {
  success: false;
  message: string;
  errors?: Record<string, string[]>; // field-level validation errors
  code?: string;                     // machine-readable error code
}

export const sendSuccess = <T>(
  res: Response,
  statusCode: number,
  message: string,
  data: T,
  meta?: Record<string, unknown>
): Response => {
  const payload: SuccessPayload<T> = { success: true, message, data };
  if (meta) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  options?: { errors?: Record<string, string[]>; code?: string }
): Response => {
  const payload: ErrorPayload = { success: false, message, ...options };
  return res.status(statusCode).json(payload);
};