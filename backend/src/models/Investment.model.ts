import mongoose, { Document, Schema, Model } from 'mongoose';

export enum InvestmentStatus {
  PLEDGED = 'PLEDGED',
  CONFIRMED = 'CONFIRMED',
  LOCKED = 'LOCKED',
  PAID_OUT = 'PAID_OUT',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
}

/**
 * PayoutStatus is the state machine for the BullMQ B2C disbursement job.
 * It is independent of InvestmentStatus — an investment can be LOCKED
 * (escrow state) while its payout is PROCESSING (queue state).
 *
 * PENDING     → Job not yet enqueued (pre-settlement)
 * QUEUED      → Job added to BullMQ, awaiting worker pickup
 * PROCESSING  → Worker has picked up job, B2C call in flight
 * SUCCESS     → Daraja B2C callback confirmed receipt
 * FAILED      → All retries exhausted, moved to dead-letter queue
 * MANUAL_HOLD → Admin must manually re-trigger after dead-letter
 */
export enum PayoutStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  MANUAL_HOLD = 'MANUAL_HOLD',
}

export enum InvestorType {
  RETAIL = 'RETAIL',
  PLATFORM = 'PLATFORM',
}

export interface IInvestment extends Document {
  _id: mongoose.Types.ObjectId;
  campaignId: mongoose.Types.ObjectId;
  investorId: mongoose.Types.ObjectId;
  investorType: InvestorType;

  amountInvestedKes: number;
  expectedReturnPercent: number;
  expectedProfitKes: number;
  expectedPayoutKes: number;
  actualProfitKes?: number;
  actualPayoutKes?: number;

  // ── Payout Queue State ───────────────────────────────────────
  payoutStatus: PayoutStatus;
  payoutJobId?: string;              // BullMQ job ID for tracking
  payoutAttempts: number;            // How many B2C attempts made
  lastPayoutError?: string;          // Last failure reason from Daraja
  deadLetterAt?: Date;               // When job moved to dead-letter

  // ── M-Pesa References ────────────────────────────────────────
  mpesaCheckoutRequestId?: string;
  mpesaReceiptNumber?: string;
  payoutMpesaReceiptNumber?: string;
  payoutMpesaConversationId?: string; // B2C originator conversation ID

  status: InvestmentStatus;
  pledgedAt: Date;
  confirmedAt?: Date;
  paidOutAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InvestmentSchema = new Schema<IInvestment>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'LPOCampaign',
      required: true,
      index: true,
    },
    investorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    investorType: {
      type: String,
      enum: Object.values(InvestorType),
      required: true,
      default: InvestorType.RETAIL,
    },
    amountInvestedKes: { type: Number, required: true, min: 1 },
    expectedReturnPercent: { type: Number, required: true, min: 0 },
    expectedProfitKes: { type: Number, required: true, min: 0 },
    expectedPayoutKes: { type: Number, required: true, min: 1 },
    actualProfitKes: { type: Number, min: 0 },
    actualPayoutKes: { type: Number, min: 0 },

    payoutStatus: {
      type: String,
      enum: Object.values(PayoutStatus),
      default: PayoutStatus.PENDING,
      index: true,
    },
    payoutJobId: { type: String, sparse: true },
    payoutAttempts: { type: Number, default: 0 },
    lastPayoutError: { type: String },
    deadLetterAt: { type: Date },

    mpesaCheckoutRequestId: { type: String, sparse: true },
    mpesaReceiptNumber: { type: String, sparse: true },
    payoutMpesaReceiptNumber: { type: String, sparse: true },
    payoutMpesaConversationId: { type: String, sparse: true },

    status: {
      type: String,
      enum: Object.values(InvestmentStatus),
      default: InvestmentStatus.PLEDGED,
    },
    pledgedAt: { type: Date, default: Date.now },
    confirmedAt: { type: Date },
      paidOutAt: { type: Date },
  },
  { timestamps: true }
);

InvestmentSchema.index({ campaignId: 1, status: 1 });
InvestmentSchema.index({ campaignId: 1, payoutStatus: 1 });
InvestmentSchema.index({ campaignId: 1, investorId: 1 });
InvestmentSchema.index({ payoutStatus: 1, deadLetterAt: 1 }); // Dead-letter sweeper

InvestmentSchema.pre<IInvestment>('save', function (next) {
  if (this.isNew) {
    this.expectedProfitKes = Math.floor(
      (this.amountInvestedKes * this.expectedReturnPercent) / 100
    );
    this.expectedPayoutKes = this.amountInvestedKes + this.expectedProfitKes;
  }
  next();
});

export const Investment: Model<IInvestment> = mongoose.model<IInvestment>(
  'Investment',
  InvestmentSchema
);