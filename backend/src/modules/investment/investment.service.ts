import mongoose from 'mongoose';
import {
  Investment,
  IInvestment,
  InvestmentStatus,
  InvestorType,
  PayoutStatus, // ← ADDED THIS IMPORT
} from '../../models/Investment.model';
import {
  LPOCampaign,
  CampaignStatus,
} from '../../models/LPOCampaign.model';
import { AppError } from '../../middleware/errorHandler.middleware';
import { logger } from '../../utils/logger';

export interface PledgeInvestmentDto {
  campaignId: string;
  amountInvestedKes: number; // In cents
}

/**
 * Creates an Investment pledge record.
 * M-Pesa STK Push is initiated in Sprint 3 (Escrow/Daraja module).
 * This service creates the PLEDGED record; confirmation happens
 * in the M-Pesa callback handler.
 *
 * TOP-UP POLICY (branching point):
 * - If you answered "No top-ups": we check for an existing CONFIRMED/LOCKED
 * investment and throw if found.
 * - If you answered "Yes top-ups": we skip that check and always create a
 * new Investment document.
 *
 * Currently implementing: YES top-ups (multiple investments per investor per campaign).
 * Change the ALLOW_TOPUPS constant below to switch behavior.
 */

export const pledgeInvestment = async (
  dto: PledgeInvestmentDto,
  investorId: string
): Promise<IInvestment> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Verify campaign exists and is in FUNDING status
    const campaign = await LPOCampaign.findById(dto.campaignId)
      .session(session)
      .exec();

    if (!campaign) {
      throw new AppError('Campaign not found.', 404, 'CAMPAIGN_NOT_FOUND');
    }

    if (campaign.status !== CampaignStatus.FUNDING) {
      throw new AppError(
        'This campaign is not currently accepting investments.',
        400,
        'CAMPAIGN_NOT_FUNDING'
      );
    }

    if (new Date() > campaign.deadline) {
      throw new AppError(
        'This campaign funding deadline has passed.',
        400,
        'CAMPAIGN_DEADLINE_PASSED'
      );
    }

    // 2. Check minimum investment amount (KES 100 = 10000 cents)
    const MIN_INVESTMENT_CENTS = 10000;
    if (dto.amountInvestedKes < MIN_INVESTMENT_CENTS) {
      throw new AppError(
        'Minimum investment is KES 100.',
        400,
        'BELOW_MINIMUM_INVESTMENT'
      );
    }

    // 3. Check if investment would exceed remaining campaign target
    const remainingKes =
      campaign.targetAmountKes - campaign.currentFundedAmountKes;

    if (dto.amountInvestedKes > remainingKes) {
      throw new AppError(
        `Investment exceeds remaining campaign capacity. Maximum you can invest: KES ${remainingKes / 100}.`,
        400,
        'EXCEEDS_CAMPAIGN_CAPACITY'
      );
    }


    // 5. Create PLEDGED investment record
    const [investment] = await Investment.create(
      [
        {
          campaignId: new mongoose.Types.ObjectId(dto.campaignId),
          investorId: new mongoose.Types.ObjectId(investorId),
          investorType: InvestorType.RETAIL,
          amountInvestedKes: dto.amountInvestedKes,
          expectedReturnPercent: campaign.expectedReturnPercent,
          // expectedProfitKes and expectedPayoutKes computed in pre-save hook
          status: InvestmentStatus.PLEDGED,
          pledgedAt: new Date(),
        },
      ],
      { session }
    );

    await session.commitTransaction();
    logger.info(
      `Investment pledged: ${investment._id} | Investor: ${investorId} | Campaign: ${dto.campaignId} | Amount: KES ${dto.amountInvestedKes / 100}`
    );

    // Sprint 3: M-Pesa STK Push will be triggered here, passing investment._id
    // as the accountReference so the callback can locate and confirm this record.

    return investment;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

/**
 * Investor: Get all their own investments with campaign summary.
 */
export const getInvestorPortfolio = async (
  investorId: string
): Promise<IInvestment[]> => {
  return Investment.find({ investorId, investorType: InvestorType.RETAIL })
    .populate('campaignId', 'commodity publicData targetAmountKes expectedReturnPercent status deadline')
    .sort({ createdAt: -1 })
    .exec();
};

/**
 * Admin: Fetch all investments currently stuck in MANUAL_HOLD for the DLQ.
 */
export const getManualHoldInvestments = async () => {
  const investments = await Investment.find({ payoutStatus: PayoutStatus.MANUAL_HOLD })
    .populate('investorId', 'fullName phoneNumber')
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  return investments as unknown as any[]; 
};