// settlement.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as SettlementService from './settlement.service';
import { sendSuccess } from '../../utils/apiResponse';

export const triggerSettlement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { campaignId } = req.params;
    const { settlementTransactionRef, totalSettledAmountKes } = req.body;

    const result = await SettlementService.initiateSettlement(
      campaignId,
      settlementTransactionRef,
      totalSettledAmountKes, // In cents
      req.user!.userId
    );

    sendSuccess(
      res,
      200,
      `Settlement initiated. ${result.totalJobs} payout jobs enqueued.`,
      result
    );
  } catch (err) {
    next(err);
  }
};

// settlement.controller.ts — add this controller
export const retryFailedPayout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { investmentId } = req.params;

    const investment = await Investment.findById(investmentId)
      .populate<{ investorId: { phoneNumber: string } }>('investorId', 'phoneNumber')
      .exec();

    if (!investment) {
      throw new AppError('Investment not found.', 404, 'INVESTMENT_NOT_FOUND');
    }

    if (investment.payoutStatus !== PayoutStatus.MANUAL_HOLD) {
      throw new AppError(
        `Investment is not in MANUAL_HOLD. Current status: ${investment.payoutStatus}`,
        400,
        'NOT_IN_MANUAL_HOLD'
      );
    }

    const investorPhone = (investment.investorId as any).phoneNumber as string;

    // Reset state and re-enqueue with a fresh jobId (bypasses BullMQ dedup)
    await Investment.findByIdAndUpdate(investmentId, {
      payoutStatus: PayoutStatus.QUEUED,
      payoutMpesaConversationId: undefined,
      lastPayoutError: undefined,
      deadLetterAt: undefined,
    });

    const retryJobId = `payout-manual-retry:${investmentId}:${Date.now()}`;

    await payoutQueue.add(
      retryJobId,
      {
        investmentId,
        campaignId: investment.campaignId.toString(),
        investorPhoneNumber: investorPhone,
        payoutAmountKes: investment.actualPayoutKes!,
        actualProfitKes: investment.actualProfitKes!,
        remarks: 'Akripesa LPO Return',
      },
      { jobId: retryJobId, attempts: 5, backoff: { type: 'exponential', delay: 10_000 } }
    );

    sendSuccess(res, 200, 'Payout job re-queued for manual retry.', {
      investmentId,
      retryJobId,
    });
  } catch (err) {
    next(err);
  }
};