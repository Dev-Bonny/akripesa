import mongoose, { Document, Schema, Model } from 'mongoose';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum CampaignStatus {
  DRAFT = 'DRAFT',                          // Admin is building, not published
  FUNDING = 'FUNDING',                      // Live — investors can pledge
  AWAITING_PLATFORM_FILL = 'AWAITING_PLATFORM_FILL', // Deadline hit, < 100% funded
  FULLY_FUNDED = 'FULLY_FUNDED',            // 100% reached, awaiting execution
  LOCKED_IN_TRANSIT = 'LOCKED_IN_TRANSIT', // Produce dispatched, OTPs active
  AWAITING_SETTLEMENT = 'AWAITING_SETTLEMENT', // Delivered, awaiting buyer wire
  COMPLETED = 'COMPLETED',                  // Settled, investors paid out
  CANCELLED = 'CANCELLED',                  // Admin-voided
}

export enum PublicClientCategory {
  TIER1_PRIVATE_HOSPITAL = 'Tier-1 Private Hospital',
  TIER2_PUBLIC_HOSPITAL = 'Tier-2 Public Hospital',
  NATIONAL_BOARDING_SCHOOL = 'National Boarding School',
  COUNTY_BOARDING_SCHOOL = 'County Boarding School',
  HOTEL_CHAIN = 'Hotel Chain',
  SUPERMARKET_CHAIN = 'Supermarket Chain',
  GOVERNMENT_INSTITUTION = 'Government Institution',
  FOOD_PROCESSOR = 'Food Processor',
}

export enum Commodity {
  MAIZE = 'MAIZE',
  POTATOES = 'POTATOES',
  BEANS = 'BEANS',
  TOMATOES = 'TOMATOES',
  ONIONS = 'ONIONS',
  CABBAGES = 'CABBAGES',
  KALES = 'KALES',
  RICE = 'RICE',
  WHEAT = 'WHEAT',
  SORGHUM = 'SORGHUM',
}

// ─── Sub-document Interfaces ──────────────────────────────────────────────────

/**
 * INTERNAL — Admin-only. NEVER exposed to investors.
 * Stored with select: false to prevent accidental leakage.
 */
interface IInternalClientData {
  clientName: string;          // e.g., "Nairobi Hospital"
  clientContact: {
    name: string;
    phone: string;
    email: string;
  };
  lpoDocumentUrl: string;      // Secure S3/GCS URL to signed LPO scan
  contractValue: number;       // The FULL contract value (KES, in cents)
  expectedSettlementDate: Date;
  internalNotes?: string;
}

/**
 * PUBLIC — Visible to investors. Sanitized alias of the real buyer.
 */
interface IPublicClientData {
  category: PublicClientCategory;
  historySummary: string;       // e.g., "100% on-time repayment rate, 3 prior contracts"
  verifiedByPlatform: boolean;
}

interface IFarmerAllocation {
  farmerId: mongoose.Types.ObjectId;
  allocatedQuantityKg: number;
  allocatedAmountKes: number;   // In cents
  isPaid: boolean;
  paidAt?: Date;
}

interface IPlatformInjection {
  wasInjected: boolean;
  injectedAmountKes: number;    // In cents
  injectedAt?: Date;
  bankTransactionRef?: string;
  isRepaid: boolean;
  repaidAt?: Date;
}

// ─── Main Interface ───────────────────────────────────────────────────────────

export interface ILPOCampaign extends Document {
  _id: mongoose.Types.ObjectId;

  // ── Internal (Admin-only) ──────────────────────────────────────
  internalData: IInternalClientData;    // select: false

  // ── Public (Investor-facing) ───────────────────────────────────
  publicData: IPublicClientData;

  // ── Campaign Financials ────────────────────────────────────────
  commodity: Commodity;
  quantityKg: number;
  
  /**
   * targetAmountKes: The crowdfunding TARGET shown to investors (KES, in cents).
   * This is the cost-of-goods figure, NOT the full contract value.
   * The spread between contractValue and targetAmountKes = platform gross margin.
   */
  targetAmountKes: number;
  currentFundedAmountKes: number;
  fundingProgressPercent: number;       // Computed field (virtual)
  
  /**
   * expectedReturnPercent: e.g., 5.00 means 5% ROI.
   * Stored as a decimal for precision: 5% = 5.00, not 0.05.
   * The payout engine will divide by 100 during math.
   */
  expectedReturnPercent: number;
  durationDays: number;
  deadline: Date;

  // ── Logistics ─────────────────────────────────────────────────
  pickupLocation: {
    type: 'Point';
    coordinates: [number, number];
    address: string;
  };
  deliveryLocation: {
    type: 'Point';
    coordinates: [number, number];
    address: string;
  };
  farmerAllocations: IFarmerAllocation[];

  // ── Platform Injection / Underwriting ─────────────────────────
  platformInjection: IPlatformInjection;

  // ── Settlement ────────────────────────────────────────────────
  settlementTransactionRef?: string;    // The buyer's bank wire reference
  settledAt?: Date;

  // ── State ────────────────────────────────────────────────────
  status: CampaignStatus;
  createdBy: mongoose.Types.ObjectId;   // Admin user ID
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const InternalClientDataSchema = new Schema<IInternalClientData>(
  {
    clientName: { type: String, required: true, trim: true },
    clientContact: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: true, lowercase: true },
    },
    lpoDocumentUrl: { type: String, required: true },
    contractValue: { type: Number, required: true, min: 1 },
    expectedSettlementDate: { type: Date, required: true },
    internalNotes: { type: String },
  },
  { _id: false }
);

const PublicClientDataSchema = new Schema<IPublicClientData>(
  {
    category: {
      type: String,
      enum: Object.values(PublicClientCategory),
      required: true,
    },
    historySummary: { type: String, required: true, trim: true },
    verifiedByPlatform: { type: Boolean, default: false },
  },
  { _id: false }
);

const FarmerAllocationSchema = new Schema<IFarmerAllocation>(
  {
    farmerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    allocatedQuantityKg: { type: Number, required: true, min: 0 },
    allocatedAmountKes: { type: Number, required: true, min: 0 },
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
  },
  { _id: false }
);

const PlatformInjectionSchema = new Schema<IPlatformInjection>(
  {
    wasInjected: { type: Boolean, default: false },
    injectedAmountKes: { type: Number, default: 0, min: 0 },
    injectedAt: { type: Date },
    bankTransactionRef: { type: String },
    isRepaid: { type: Boolean, default: false },
    repaidAt: { type: Date },
  },
  { _id: false }
);

const LPOCampaignSchema = new Schema<ILPOCampaign>(
  {
    // ── Internal — select: false is the primary firewall ──────────
    internalData: {
      type: InternalClientDataSchema,
      required: true,
      select: false, // ← CRITICAL: Never included in default queries
    },

    // ── Public ────────────────────────────────────────────────────
    publicData: { type: PublicClientDataSchema, required: true },

    // ── Financials ────────────────────────────────────────────────
    commodity: {
      type: String,
      enum: Object.values(Commodity),
      required: true,
    },
    quantityKg: { type: Number, required: true, min: 1 },
    targetAmountKes: { type: Number, required: true, min: 1 },
    currentFundedAmountKes: { type: Number, default: 0, min: 0 },
    expectedReturnPercent: {
      type: Number,
      required: true,
      min: 0.01,
      max: 100,
    },
    durationDays: { type: Number, required: true, min: 1 },
    deadline: { type: Date, required: true },

    // ── Locations ─────────────────────────────────────────────────
    pickupLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
      address: { type: String, required: true },
    },
    deliveryLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
      address: { type: String, required: true },
    },

    farmerAllocations: { type: [FarmerAllocationSchema], default: [] },
    platformInjection: { type: PlatformInjectionSchema, required: true, default: () => ({}) },

    settlementTransactionRef: { type: String },
    settledAt: { type: Date },

    status: {
      type: String,
      enum: Object.values(CampaignStatus),
      default: CampaignStatus.DRAFT,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────

LPOCampaignSchema.virtual('fundingProgressPercent').get(function (this: ILPOCampaign) {
  if (this.targetAmountKes === 0) return 0;
  return parseFloat(
    ((this.currentFundedAmountKes / this.targetAmountKes) * 100).toFixed(2)
  );
});

// ─── Indexes ──────────────────────────────────────────────────────────────────

LPOCampaignSchema.index({ status: 1, deadline: 1 });
LPOCampaignSchema.index({ commodity: 1, status: 1 });
LPOCampaignSchema.index({ pickupLocation: '2dsphere' });
LPOCampaignSchema.index({ deliveryLocation: '2dsphere' });

// ─── Pre-save Validation ──────────────────────────────────────────────────────

LPOCampaignSchema.pre<ILPOCampaign>('save', function (next) {
  // Invariant: target amount must be less than contract value (the spread is profit)
  if (
    this.isNew &&
    this.internalData &&
    this.targetAmountKes >= this.internalData.contractValue
  ) {
    return next(
      new Error(
        'targetAmountKes must be less than contractValue. The spread is platform gross margin.'
      )
    );
  }

  // Invariant: funded amount cannot exceed target
  if (this.currentFundedAmountKes > this.targetAmountKes) {
    return next(
      new Error('currentFundedAmountKes cannot exceed targetAmountKes.')
    );
  }

  next();
});

export const LPOCampaign: Model<ILPOCampaign> = mongoose.model<ILPOCampaign>(
  'LPOCampaign',
  LPOCampaignSchema
);