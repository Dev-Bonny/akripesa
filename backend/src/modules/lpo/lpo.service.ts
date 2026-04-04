import mongoose from 'mongoose';
import {
  LPOCampaign,
  ILPOCampaign,
  CampaignStatus,
} from '../../models/LPOCampaign.model';
import { AppError } from '../../middleware/errorHandler.middleware';
import { logger } from '../../utils/logger';
import {
  Investment,
  InvestmentStatus,
  PayoutStatus,
  InvestorType,
} from '../../models/Investment.model';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateLPODto {
  internalData: {
    clientName: string;
    clientContact: { name: string; phone: string; email: string };
    lpoDocumentUrl: string;
    contractValue: number;
    expectedSettlementDate: string;
    internalNotes?: string;
  };
  publicData: {
    category: string;
    historySummary: string;
    verifiedByPlatform: boolean;
  };
  commodity: string;
  quantityKg: number;
  targetAmountKes: number;
  expectedReturnPercent: number;
  durationDays: number;
  deadline: string;
  pickupLocation: {
    coordinates: [number, number];
    address: string;
  };
  deliveryLocation: {
    coordinates: [number, number];
    address: string;
  };
}

// ─── Service Methods ──────────────────────────────────────────────────────────

/**
 * Admin: Create a new LPO campaign (starts in DRAFT status).
 */
export const createCampaign = async (
  dto: CreateLPODto,
  adminUserId: string
): Promise<ILPOCampaign> => {
  const campaign = new LPOCampaign({
    ...dto,
    deadline: new Date(dto.deadline),
    internalData: {
      ...dto.internalData,
      expectedSettlementDate: new Date(dto.internalData.expectedSettlementDate),
    },
    pickupLocation: { type: 'Point', ...dto.pickupLocation },
    deliveryLocation: { type: 'Point', ...dto.deliveryLocation },
    status: CampaignStatus.DRAFT,
    createdBy: new mongoose.Types.ObjectId(adminUserId),
  });

  await campaign.save();
  logger.info(`LPO Campaign created: ${campaign._id} by admin ${adminUserId}`);
  return campaign;
};

/**
 * Admin: Publish a DRAFT campaign to FUNDING status.
 * Validates the campaign is complete before exposing to investors.
 */
export const publishCampaign = async (
  campaignId: string,
  adminUserId: string
): Promise<ILPOCampaign> => {
  // Must select +internalData to run the pre-publish validation
  const campaign = await LPOCampaign.findById(campaignId)
    .select('+internalData')
    .exec();

  if (!campaign) {
    throw new AppError('Campaign not found.', 404, 'CAMPAIGN_NOT_FOUND');
  }

  if (campaign.status !== CampaignStatus.DRAFT) {
    throw new AppError(
      `Cannot publish a campaign with status: ${campaign.status}.`,
      400,
      'INVALID_STATUS_TRANSITION'
    );
  }

  if (!campaign.internalData?.lpoDocumentUrl) {
    throw new AppError(
      'Cannot publish campaign without a verified LPO document.',
      400,
      'MISSING_LPO_DOCUMENT'
    );
  }

  campaign.status = CampaignStatus.FUNDING;
  await campaign.save();

  logger.info(`Campaign ${campaignId} published to FUNDING by admin ${adminUserId}`);
  return campaign;
};

/**
 * Admin: Get a single campaign WITH internal data (admin dashboard use).
 */
export const getCampaignWithInternalData = async (
  campaignId: string
): Promise<ILPOCampaign> => {
  const campaign = await LPOCampaign.findById(campaignId)
    .select('+internalData')
    .populate('createdBy', 'fullName phoneNumber')
    .exec();

  if (!campaign) {
    throw new AppError('Campaign not found.', 404, 'CAMPAIGN_NOT_FOUND');
  }

  return campaign;
};

/**
 * Public / Investor: Get active funding campaigns WITHOUT internal data.
 * internalData is NOT selected — select:false enforces this at the schema level.
 */
export const getPublicFundingCampaigns = async (filters: {
  commodity?: string;
  page?: number;
  limit?: number;
}): Promise<{ campaigns: ILPOCampaign[]; total: number; pages: number }> => {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 10));
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {
    status: CampaignStatus.FUNDING,
    deadline: { $gt: new Date() },
  };

  if (filters.commodity) {
    query.commodity = filters.commodity.toUpperCase();
  }

  const [campaigns, total] = await Promise.all([
    LPOCampaign.find(query)
      // Deliberately NOT selecting +internalData
      .sort({ deadline: 1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    LPOCampaign.countDocuments(query),
  ]);

  return {
    campaigns: campaigns as ILPOCampaign[],
    total,
    pages: Math.ceil(total / limit),
  };
};

/**
 * Admin: Update campaign details (DRAFT status only).
 */
export const updateCampaignDraft = async (
  campaignId: string,
  updates: Partial<CreateLPODto>
): Promise<ILPOCampaign> => {
  const campaign = await LPOCampaign.findById(campaignId).exec();

  if (!campaign) {
    throw new AppError('Campaign not found.', 404, 'CAMPAIGN_NOT_FOUND');
  }

  if (campaign.status !== CampaignStatus.DRAFT) {
    throw new AppError(
      'Only DRAFT campaigns can be edited.',
      400,
      'EDIT_LOCKED'
    );
  }

  Object.assign(campaign, updates);
  await campaign.save();
  return campaign;
};

// ─── NEW ADMIN SERVICE ADDED BELOW ──────────────────────────────────────────

/**
 * Admin: Get ALL campaigns with internal data for the Underwriting Hub table.
 * Returns every campaign regardless of status.
 * internalData is explicitly selected — admin sees everything.
 */
export const getAllCampaignsForAdmin = async (): Promise<ILPOCampaign[]> => {
  const campaigns = await LPOCampaign.find({})
    .select('+internalData')
    .sort({ createdAt: -1 })
    .lean()
    .exec();
  return campaigns as ILPOCampaign[];
};

/**
 * Admin: Get payout summaries per campaign for the DLQ Monitor.
 * Returns campaigns that are in AWAITING_SETTLEMENT or COMPLETED status
 * along with all their associated Investment documents.
 */
export const getPayoutSummaries = async (): Promise<
  Array<{
    campaign: Partial<ILPOCampaign>;
    investments: any[];
    totalInvestors: number;
    successCount: number;
    pendingCount: number;
    failedCount: number;
    manualHoldCount: number;
  }>
> => {
  const campaigns = await LPOCampaign.find({
    status: {
      $in: [
        CampaignStatus.AWAITING_SETTLEMENT,
        CampaignStatus.COMPLETED,
        CampaignStatus.LOCKED_IN_TRANSIT,
      ],
    },
  })
    .select(
      'commodity publicData status hasPayoutFailures targetAmountKes currentFundedAmountKes'
    )
    .lean()
    .exec();

  const summaries = await Promise.all(
    campaigns.map(async (campaign) => {
      const investments = await Investment.find({
        campaignId: campaign._id,
      })
        .populate('investorId', 'phoneNumber fullName')
        .lean()
        .exec();

      const successCount     = investments.filter((i) => i.payoutStatus === PayoutStatus.SUCCESS).length;
      const pendingCount     = investments.filter((i) =>
        [PayoutStatus.PENDING, PayoutStatus.QUEUED, PayoutStatus.PROCESSING].includes(i.payoutStatus)
      ).length;
      const failedCount      = investments.filter((i) => i.payoutStatus === PayoutStatus.FAILED).length;
      const manualHoldCount  = investments.filter((i) => i.payoutStatus === PayoutStatus.MANUAL_HOLD).length;

      return {
        campaign,
        investments,
        totalInvestors: investments.length,
        successCount,
        pendingCount,
        failedCount,
        manualHoldCount,
      };
    })
  );

  return summaries;
};