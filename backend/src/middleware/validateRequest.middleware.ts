import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/apiResponse';

/**
 * Generic Zod validation middleware.
 * Validates req.body against the provided schema.
 * Returns 422 with field-level errors on failure.
 */
export const validateRequest = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = (result.error as ZodError).flatten().fieldErrors as Record<string, string[]>;
      
      sendError(res, 422, 'Validation failed.', {
        errors,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    req.body = result.data; // Replace with parsed/coerced data
    next();
  };
};