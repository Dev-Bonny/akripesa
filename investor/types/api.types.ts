export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  meta?: { total?: number; pages?: number; page?: number };
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type CampaignStatus =
  | 'DRAFT' | 'FUNDING' | 'AWAITING_PLATFORM_FILL'
  | 'FULLY_FUNDED' | 'LOCKED_IN_TRANSIT'
  | 'AWAITING_SETTLEMENT' | 'COMPLETED' | 'CANCELLED';

export type Commodity =
  | 'MAIZE' | 'POTATOES' | 'BEANS' | 'TOMATOES' | 'ONIONS'
  | 'CABBAGES' | 'KALES' | 'RICE' | 'WHEAT' | 'SORGHUM';

export interface LPOCampaign {
  _id: string;
  publicData: {
    category: string;
    historySummary: string;
    verifiedByPlatform: boolean;
  };
  commodity: Commodity;
  quantityKg: number;
  targetAmountKes: number;
  currentFundedAmountKes: number;
  fundingProgressPercent: number;
  expectedReturnPercent: number;
  durationDays: number;
  deadline: string;
  pickupLocation:  { coordinates: [number, number]; address: string };
  deliveryLocation:{ coordinates: [number, number]; address: string };
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
}

export type PayoutStatus =
  | 'PENDING' | 'QUEUED' | 'PROCESSING'
  | 'SUCCESS' | 'FAILED' | 'MANUAL_HOLD';

export type InvestmentStatus =
  | 'PLEDGED' | 'CONFIRMED' | 'LOCKED' | 'PAID_OUT' | 'REFUNDED' | 'FAILED';

export interface Investment {
  _id: string;
  campaignId: string | LPOCampaign;
  investorType: 'RETAIL' | 'PLATFORM';
  amountInvestedKes: number;
  expectedReturnPercent: number;
  expectedProfitKes: number;
  expectedPayoutKes: number;
  actualProfitKes?: number;
  actualPayoutKes?: number;
  payoutStatus: PayoutStatus;
  status: InvestmentStatus;
  mpesaReceiptNumber?: string;
  payoutMpesaReceiptNumber?: string;
  pledgedAt: string;
  confirmedAt?: string;
  paidOutAt?: string;
  createdAt: string;
}

export interface InvestorProfile {
  _id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  mpesaWallet: {
    phoneNumber: string;
    totalDeposited: number;
    totalWithdrawn: number;
    currentBalance: number;
  };
  kycStatus: 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
}