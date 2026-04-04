import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Safaricom's documented callback IP ranges (as of 2024).
 * These should be verified against Safaricom's latest developer documentation
 * before going live and updated as needed.
 */
const SAFARICOM_CALLBACK_IPS = new Set([
  '196.201.214.200',
  '196.201.214.206',
  '196.201.213.114',
  '196.201.214.207',
  '196.201.214.208',
  '196.201.213.44',
  '196.201.212.127',
  '196.201.212.138',
  '196.201.212.129',
  '196.201.212.136',
  '196.201.212.74',
  '196.201.212.69',
]);

/**
 * Validates inbound Daraja callbacks via:
 * 1. URL path secret (:secret param must match env.DARAJA_CALLBACK_SECRET)
 * 2. IP whitelist check against Safaricom's known IPs
 *    (bypassed in sandbox/development environments)
 */
export const validateDarajaCallback = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // ── Secret validation ──────────────────────────────────────────────────────
  const providedSecret = req.params.secret;

  if (!providedSecret || providedSecret !== env.DARAJA_CALLBACK_SECRET) {
    logger.warn(
      `Daraja callback rejected: invalid secret | IP: ${req.ip} | Path: ${req.path}`
    );
    // Return 200 to Safaricom to prevent retries — just don't process
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    return;
  }

  // ── IP whitelist (production only) ────────────────────────────────────────
  if (env.NODE_ENV === 'production') {
    const requestIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      '';

    if (!SAFARICOM_CALLBACK_IPS.has(requestIp)) {
      logger.warn(
        `Daraja callback rejected: unauthorized IP ${requestIp} | Path: ${req.path}`
      );
      res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
      return;
    }
  }

  next();
};