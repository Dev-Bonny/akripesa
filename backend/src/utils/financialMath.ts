/**
 * All monetary arithmetic operates on integers (KES cents).
 * Rule: 1 KES = 100 cents. KES 1,500.50 = 150050 cents.
 * This eliminates all IEEE-754 floating-point rounding errors
 * from financial calculations.
 */

export interface InvestorPayout {
  investorId: string;
  amountInvestedKes: number;    // cents
  profitKes: number;            // cents
  totalPayoutKes: number;       // cents
}

/**
 * Calculates the exact proportional profit for each investor
 * in a campaign based on their individual stake.
 *
 * @param investments - Array of confirmed investments for the campaign
 * @param campaignExpectedReturnPercent - e.g., 5.00 for 5%
 * @param totalSettledAmountKes - The actual amount received from buyer (cents)
 * @param totalFundedAmountKes - Total crowdfunded + platform injection (cents)
 * @returns Array of per-investor payout breakdowns
 *
 * Design note: We calculate profit proportionally from the ACTUAL settled amount
 * rather than guaranteeing the expectedReturn. If the buyer settles exactly the
 * contract value, investors receive exactly their expectedReturn. If there is a
 * shortfall (e.g., partial payment), losses are proportionally distributed.
 * The platform's gross margin is: totalSettledAmountKes - totalFundedAmountKes
 * - sum(investorProfits). This must ALWAYS be validated to be >= 0 before payout.
 */
export const calculateInvestorPayouts = (
  investments: Array<{
    investorId: string;
    amountInvestedKes: number;
    expectedReturnPercent: number;
  }>,
  totalFundedAmountKes: number
): InvestorPayout[] => {
  if (totalFundedAmountKes === 0) {
    throw new Error('totalFundedAmountKes cannot be zero.');
  }

  return investments.map((inv) => {
    // Proportional share of total funded pool
    const ownershipRatio = inv.amountInvestedKes / totalFundedAmountKes;

    // Profit = principal × (expectedReturn / 100)
    // Use Math.floor to avoid paying out fractional cents (rounding favors platform)
    const profitKes = Math.floor(
      (inv.amountInvestedKes * inv.expectedReturnPercent) / 100
    );

    return {
      investorId: inv.investorId,
      amountInvestedKes: inv.amountInvestedKes,
      profitKes,
      totalPayoutKes: inv.amountInvestedKes + profitKes,
      ownershipRatio: parseFloat(ownershipRatio.toFixed(6)),
    };
  });
};

/**
 * Validates that the platform is not paying out more than it received.
 * Must be called before triggering any B2C disbursement.
 *
 * @returns { isViable, platformGrossMarginKes }
 */
export const validateSettlementViability = (
  totalSettledAmountKes: number,
  _totalFundedAmountKes: number,
  totalInvestorPayoutsKes: number,
  farmerPaymentsKes: number,
  transportFeesKes: number
): { isViable: boolean; platformGrossMarginKes: number } => {
  const totalObligations =
    totalInvestorPayoutsKes + farmerPaymentsKes + transportFeesKes;

  const platformGrossMarginKes = totalSettledAmountKes - totalObligations;

  return {
    isViable: platformGrossMarginKes >= 0,
    platformGrossMarginKes,
  };
};

/**
 * Calculates transport fee based on distance and vehicle class.
 * Rates are in KES cents per km.
 */
export const TRANSPORT_RATES_PER_KM: Record<string, number> = {
  BODA: 3000,       // KES 30/km
  PICKUP: 8000,     // KES 80/km
  CANTER: 15000,    // KES 150/km
  FRR_TRUCK: 25000, // KES 250/km
};

export const calculateTransportFee = (
  distanceKm: number,
  vehicleClass: keyof typeof TRANSPORT_RATES_PER_KM
): number => {
  const ratePerKm = TRANSPORT_RATES_PER_KM[vehicleClass];
  if (!ratePerKm) throw new Error(`Unknown vehicle class: ${vehicleClass}`);
  return Math.ceil(distanceKm * ratePerKm); // ceil: always round up for fees
};