import { Request, Response, NextFunction } from 'express';
import * as InvestmentService from './investment.service';
import { sendSuccess } from '../../utils/apiResponse';

export const pledgeInvestment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const investment = await InvestmentService.pledgeInvestment(
      req.body,
      req.user!.userId
    );
    sendSuccess(
      res,
      201,
      'Investment pledged. M-Pesa payment request initiated.',
      {
        investmentId: investment._id,
        amountKes: investment.amountInvestedKes / 100,
        expectedPayoutKes: investment.expectedPayoutKes / 100,
        status: investment.status,
      }
    );
  } catch (err) {
    next(err);
  }
};

export const getMyPortfolio = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const investments = await InvestmentService.getInvestorPortfolio(
      req.user!.userId
    );
    sendSuccess(res, 200, 'Portfolio retrieved.', investments);
  } catch (err) {
    next(err);
  }
};

// ─── NEW ADMIN CONTROLLER ADDED BELOW ────────────────────────────────────────

/**
 * GET /api/v1/campaigns/investments/manual-hold
 * Admin: Fetch all investments currently stuck in MANUAL_HOLD.
 */
export const getManualHoldInvestments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const investments = await InvestmentService.getManualHoldInvestments();
    sendSuccess(res, 200, 'Manual hold investments retrieved.', investments);
  } catch (err) {
    next(err);
  }
};