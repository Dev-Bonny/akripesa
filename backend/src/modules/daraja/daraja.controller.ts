import { Request, Response } from 'express';
import { processSTKCallback } from '../escrow/escrow.service';
import { processB2CCallback, processB2CTimeout } from './daraja.service';
import { StkPushCallback, B2CCallback } from './daraja.types';
import { logger } from '../../utils/logger';

/**
 * All Daraja callback controllers return HTTP 200 immediately.
 * Safaricom will retry callbacks if it receives a non-200 response,
 * which could cause duplicate processing. We always ACK first,
 * then process asynchronously.
 */

export const handleSTKCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  // ACK immediately to prevent Safaricom retries
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    const callback = req.body as StkPushCallback;
    await processSTKCallback(callback.Body.stkCallback);
  } catch (err) {
    // Log but don't re-throw — response already sent
    logger.error('STK callback processing error:', err);
  }
};

export const handleB2CCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    const callback = req.body as B2CCallback;
    await processB2CCallback(callback.Result);
  } catch (err) {
    logger.error('B2C callback processing error:', err);
  }
};

export const handleB2CTimeout = async (
  req: Request,
  res: Response
): Promise<void> => {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    const callback = req.body as B2CCallback;
    await processB2CTimeout(callback.Result);
  } catch (err) {
    logger.error('B2C timeout callback processing error:', err);
  }
};