// ─── API Response Envelope ────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  meta?: {
    total?: number;
    pages?: number;
    page?: number;
  };
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Campaign Types (mirrors backend models) ─────────────────────────────────

export type CampaignStatus =
  | 'DRAFT'
  | 'FUNDING'
  | 'AWAITING_PLATFORM_FILL'
  | 'FULLY_FUNDED'
  | 'LOCKED_IN_TRANSIT'
  | 'AWAITING_SETTLEMENT'
  | 'COMPLETED'
  | 'CANCELLED';

export type PublicClientCategory =
  | 'Tier-1 Private Hospital'
  | 'Tier-2 Public Hospital'
  | 'National Boarding School'
  | 'County Boarding School'
  | 'Hotel Chain'
  | 'Supermarket Chain'
  | 'Government Institution'
  | 'Food Processor';

export type Commodity =
  | 'MAIZE' | 'POTATOES' | 'BEANS' | 'TOMATOES' | 'ONIONS'
  | 'CABBAGES' | 'KALES' | 'RICE' | 'WHEAT' | 'SORGHUM';

export interface LPOCampaign {
  _id: string;
  publicData: {
    category: PublicClientCategory;
    historySummary: string;
    verifiedByPlatform: boolean;
  };
  // internalData only present on admin-specific fetches
  internalData?: {
    clientName: string;
    clientContact: { name: string; phone: string; email: string };
    lpoDocumentUrl: string;
    contractValue: number;
    expectedSettlementDate: string;
    internalNotes?: string;
  };
  commodity: Commodity;
  quantityKg: number;
  targetAmountKes: number;
  currentFundedAmountKes: number;
  fundingProgressPercent: number;
  expectedReturnPercent: number;
  durationDays: number;
  deadline: string;
  pickupLocation: { coordinates: [number, number]; address: string };
  deliveryLocation: { coordinates: [number, number]; address: string };
  platformInjection: {
    wasInjected: boolean;
    injectedAmountKes: number;
    injectedAt?: string;
  };
  hasPayoutFailures?: boolean;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Investment / Payout Types ────────────────────────────────────────────────

export type PayoutStatus =
  | 'PENDING' | 'QUEUED' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'MANUAL_HOLD';

export interface Investment {
  _id: string;
  campaignId: string | LPOCampaign;
  investorId: string;
  investorType: 'RETAIL' | 'PLATFORM';
  amountInvestedKes: number;
  expectedReturnPercent: number;
  expectedPayoutKes: number;
  actualPayoutKes?: number;
  payoutStatus: PayoutStatus;
  payoutAttempts: number;
  lastPayoutError?: string;
  deadLetterAt?: string;
  mpesaReceiptNumber?: string;
  payoutMpesaReceiptNumber?: string;
  status: string;
  createdAt: string;
}

// ─── Order Types ──────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'ESCROW_LOCKED' | 'AWAITING_DISPATCH' | 'DRIVER_ASSIGNED'
  | 'VENDOR_PREPPING' | 'IN_TRANSIT' | 'DELIVERED'
  | 'AWAITING_DRIVER' | 'DISPUTED' | 'CANCELLED' | 'SETTLED';

export interface Order {
  _id: string;
  orderType: 'B2B_SUPPLY_CHAIN' | 'B2C_LOCAL_MARKET' | 'BULK_BROKERAGE';
  status: OrderStatus;
  commodity: string;
  quantityKg: number;
  distanceKm: number;
  transportFeeKes: number;
  totalOrderValueKes: number;
  pickupLocation: { coordinates: [number, number]; address: string };
  deliveryLocation: { coordinates: [number, number]; address: string };
  assignedDriverId?: string;
  dispatchAttempts: Array<{
    driverId: string;
    vehicleClass: string;
    offeredAt: string;
    expiresAt: string;
    wasAccepted: boolean;
    wasDeclined: boolean;
  }>;
  campaignId?: string;
  createdAt: string;
  updatedAt: string;
}