import mongoose from 'mongoose';
import {
  Investment,
  InvestmentStatus,
  InvestorType,
  PayoutStatus,
} from '../../models/Investment.model';
import {
  LPOCampaign,
  CampaignStatus,
} from '../../models/LPOCampaign.model';
import { User } from '../../models/User.model';
import { payoutQueue, PayoutJobData } from '../../jobs/queues';
import {
  calculateInvestorPayouts,
  validateSettlementViability,
} from '../../utils/financialMath';
import { AppError } from '../../middleware/errorHandler.middleware';
import { logger } from '../../utils/logger';

/**
 * Settlement Engine — Entry Point.
 *
 * Called when admin clicks "Settle" after the buyer wires payment.
 *
 * This function does NOT disburse funds directly.
 * It validates the settlement, computes per-investor payouts,
 * then ENQUEUES one BullMQ job per investment.
 * Each job independently calls Daraja B2C and handles its own retries.
 *
 * @param campaignId - The campaign to settle
 * @param settlementTransactionRef - The buyer's bank wire reference
 * @param totalSettledAmountKes - Amount received from buyer (in cents)
 * @param adminUserId - For audit trail
 */
export const initiateSettlement = async (
  campaignId: string,
  settlementTransactionRef: string,
  totalSettledAmountKes: number,
  _adminUserId: string
): Promise<{ totalJobs: number; totalPayoutKes: number }> => {

  // 1. Validate campaign is in correct state
  const campaign = await LPOCampaign.findById(campaignId)
    .select('+internalData')
    .exec();

  if (!campaign) {
    throw new AppError('Campaign not found.', 404, 'CAMPAIGN_NOT_FOUND');
  }

  if (campaign.status !== CampaignStatus.AWAITING_SETTLEMENT) {
    throw new AppError(
      `Cannot settle a campaign with status: ${campaign.status}. Expected: AWAITING_SETTLEMENT.`,
      400,
      'INVALID_STATUS_FOR_SETTLEMENT'
    );
  }

  // 2. Fetch all LOCKED investments for this campaign
  const investments = await Investment.find({
    campaignId: new mongoose.Types.ObjectId(campaignId),
    status: InvestmentStatus.LOCKED,
  })
    .populate<{ investorId: { _id: mongoose.Types.ObjectId; phoneNumber: string } }>(
      'investorId',
      'phoneNumber'
    )
    .exec();

  if (investments.length === 0) {
    throw new AppError(
      'No locked investments found for this campaign.',
      400,
      'NO_LOCKED_INVESTMENTS'
    );
  }

  // 3. Calculate per-investor payouts using financialMath
  const payoutInputs = investments.map((inv) => ({
    investorId: inv._id.toString(),
    amountInvestedKes: inv.amountInvestedKes,
    expectedReturnPercent: inv.expectedReturnPercent,
  }));

  const payouts = calculateInvestorPayouts(
    payoutInputs,
    campaign.currentFundedAmountKes
  );

  // 4. Calculate farmer and transport obligations
  const totalFarmerPaymentsKes = campaign.farmerAllocations.reduce(
    (sum, fa) => sum + fa.allocatedAmountKes,
    0
  );

  // Transport fees are stored on the Order documents (Sprint 4)
  // For settlement viability, we use the campaign's targetAmountKes
  // as the denominator and assume transport is already accounted for
  // within the funded pool. Full transport fee reconciliation is in Sprint 4.
  const totalTransportFeesKes = 0; // Reconciled in Sprint 4

  const totalInvestorPayoutsKes = payouts.reduce(
    (sum, p) => sum + p.totalPayoutKes,
    0
  );

  // 5. Validate the platform is not paying out more than it received
  const { isViable, platformGrossMarginKes } = validateSettlementViability(
    totalSettledAmountKes,
    campaign.currentFundedAmountKes,
    totalInvestorPayoutsKes,
    totalFarmerPaymentsKes,
    totalTransportFeesKes
  );

  if (!isViable) {
    throw new AppError(
      `Settlement is not viable. Total obligations (KES ${(totalInvestorPayoutsKes + totalFarmerPaymentsKes) / 100}) exceed settled amount (KES ${totalSettledAmountKes / 100}). Admin review required.`,
      400,
      'SETTLEMENT_NOT_VIABLE'
    );
  }

  logger.info(
    `Settlement viable | Campaign: ${campaignId} | Settled: KES ${totalSettledAmountKes / 100} | Investor payouts: KES ${totalInvestorPayoutsKes / 100} | Platform margin: KES ${platformGrossMarginKes / 100}`
  );

  // 6. Transition campaign to AWAITING_SETTLEMENT processing
  await LPOCampaign.findByIdAndUpdate(campaignId, {
    settlementTransactionRef,
    settledAt: new Date(),
    status: CampaignStatus.COMPLETED, // Will be fully COMPLETED once all payouts succeed
  });

  // 7. Enqueue one payout job per investment (the core queue architecture)
  const payoutMap = new Map(payouts.map((p) => [p.investorId, p]));
  let totalJobsEnqueued = 0;

  for (const investment of investments) {
    const payout = payoutMap.get(investment._id.toString());

    if (!payout) {
      logger.error(`No payout calculated for investment ${investment._id}. Skipping.`);
      continue;
    }

    const investorPhone = (investment.investorId as any).phoneNumber as string;

    if (!investorPhone) {
      logger.error(
        `Cannot resolve phone for investor on investment ${investment._id}. Marking MANUAL_HOLD.`
      );
      await Investment.findByIdAndUpdate(investment._id, {
        payoutStatus: PayoutStatus.MANUAL_HOLD,
        lastPayoutError: 'Investor phone number not found at settlement time.',
      });
      continue;
    }

    // Determine payout remarks
    const isRetail = investment.investorType === InvestorType.RETAIL;
    const remarks = isRetail
      ? `Akripesa LPO Return`
      : `Akripesa Platform Return`;

    const jobPayload: PayoutJobData = {
      investmentId: investment._id.toString(),
      campaignId,
      investorPhoneNumber: investorPhone,
      payoutAmountKes: payout.totalPayoutKes,
      actualProfitKes: payout.profitKes,
      remarks,
    };

    // Mark investment as QUEUED before adding to queue
    await Investment.findByIdAndUpdate(investment._id, {
      payoutStatus: PayoutStatus.QUEUED,
    });

    // Job ID is deterministic: prevents duplicate enqueue if admin
    // accidentally clicks "Settle" twice
    await payoutQueue.add(
      `payout:${investment._id}`,
      jobPayload,
      { jobId: `payout:${investment._id}` }
    );

    totalJobsEnqueued++;

    logger.info(
      `Payout job enqueued | Investment: ${investment._id} | Phone: ${investorPhone} | Amount: KES ${payout.totalPayoutKes / 100} (Principal: ${payout.amountInvestedKes / 100} + Profit: ${payout.profitKes / 100})`
    );
  }

  // 8. Enqueue farmer payments (via separate B2C jobs — same queue, tagged differently)
  for (const allocation of campaign.farmerAllocations) {
    if (allocation.isPaid) continue;

    const farmer = await User.findById(allocation.farmerId)
      .select('phoneNumber')
      .exec();

    if (!farmer) {
      logger.error(`Farmer ${allocation.farmerId} not found. Skipping payment.`);
      continue;
    }

    const farmerJobPayload: PayoutJobData = {
      investmentId: allocation.farmerId.toString(), // Reuse field as recipient ID
      campaignId,
      investorPhoneNumber: farmer.phoneNumber,
      payoutAmountKes: allocation.allocatedAmountKes,
      actualProfitKes: 0, // Farmers receive cost price, no profit
      remarks: `Akripesa Farm Payment`,
    };

    await payoutQueue.add(
      `farmer-payment:${allocation.farmerId}:${campaignId}`,
      farmerJobPayload,
      { jobId: `farmer-payment:${allocation.farmerId}:${campaignId}` }
    );

    totalJobsEnqueued++;
  }

  logger.info(
    `Settlement initiated | Campaign: ${campaignId} | Jobs enqueued: ${totalJobsEnqueued} | Platform margin: KES ${platformGrossMarginKes / 100}`
  );

  return {
    totalJobs: totalJobsEnqueued,
    totalPayoutKes: totalInvestorPayoutsKes,
  };
};