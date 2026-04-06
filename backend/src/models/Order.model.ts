import mongoose, { Document, Schema, Model } from 'mongoose';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum OrderType {
  B2B_SUPPLY_CHAIN = 'B2B_SUPPLY_CHAIN',  // Pillar 1: LPO fulfillment
  B2C_LOCAL_MARKET = 'B2C_LOCAL_MARKET',  // Pillar 2: Instacart model
  BULK_BROKERAGE = 'BULK_BROKERAGE',      // Pillar 3: Self-funded broker
}

export enum OrderStatus {
  ESCROW_LOCKED = 'ESCROW_LOCKED',        // Funds confirmed in escrow
  AWAITING_DISPATCH = 'AWAITING_DISPATCH', // Queued for driver assignment
  DRIVER_ASSIGNED = 'DRIVER_ASSIGNED',    // Driver accepted dispatch
  VENDOR_PREPPING = 'VENDOR_PREPPING',    // B2C: Vendor packing order
  IN_TRANSIT = 'IN_TRANSIT',             // OTP 1 confirmed (loaded at source)
  DELIVERED = 'DELIVERED',               // OTP 2 confirmed (unloaded at dest)
  DISPUTED = 'DISPUTED',                 // Flagged — requires admin review
  CANCELLED = 'CANCELLED',
  SETTLED = 'SETTLED',  
  AWAITING_DRIVER = 'AWAITING_DRIVER',                 // All parties paid out
}

// ─── Sub-document Interfaces ──────────────────────────────────────────────────

interface IOtpHandshake {
  otp: string;           // 6-digit code (hashed in DB — select: false)
  isUsed: boolean;
  usedAt?: Date;
  expiresAt: Date;
}

interface IPaymentSplit {
  recipientId: mongoose.Types.ObjectId;    // User (Farmer/Vendor/Driver)
  recipientRole: 'FARMER' | 'VENDOR' | 'TRANSPORTER' | 'PLATFORM';
  amountKes: number;                       // In cents
  mpesaReceiptNumber?: string;
  isPaid: boolean;
  paidAt?: Date;
}

interface IDispatchAttempt {
  driverId: mongoose.Types.ObjectId;
  vehicleClass: string;
  offeredAt: Date;
  expiresAt: Date;       // offeredAt + 15 seconds
  wasAccepted: boolean;
  wasDeclined: boolean;
}

// ─── Main Interface ───────────────────────────────────────────────────────────

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  orderType: OrderType;
  status: OrderStatus;

  // ── References ────────────────────────────────────────────────
  campaignId?: mongoose.Types.ObjectId;    // B2B only
  buyerId: mongoose.Types.ObjectId;        // Institution / Consumer / Broker
  vendorId?: mongoose.Types.ObjectId;      // B2C only
  assignedDriverId?: mongoose.Types.ObjectId;

  // ── Commodity ─────────────────────────────────────────────────
  commodity: string;
  quantityKg: number;

  // ── Financials (all in KES cents) ────────────────────────────
  totalOrderValueKes: number;
  transportFeeKes: number;
  platformFeeKes: number;
  paymentSplits: IPaymentSplit[];

  // ── Locations ─────────────────────────────────────────────────
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
  distanceKm: number;

  // ── 2-Step OTP Handshakes ─────────────────────────────────────
  loadingOtp: IOtpHandshake;      // select: false (otp field)
  deliveryOtp: IOtpHandshake;     // select: false (otp field)

  // ── Dispatch Trail ────────────────────────────────────────────
  dispatchAttempts: IDispatchAttempt[];

  // ── M-Pesa ────────────────────────────────────────────────────
  mpesaCheckoutRequestId?: string;
  mpesaReceiptNumber?: string;

  // ── Timestamps ────────────────────────────────────────────────
  escrowLockedAt?: Date;
  dispatchedAt?: Date;
  loadedAt?: Date;
  deliveredAt?: Date;
  settledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const OtpHandshakeSchema = new Schema<IOtpHandshake>(
  {
    otp: { type: String, required: true, select: false }, // Never exposed via API
    isUsed: { type: Boolean, default: false },
    usedAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const PaymentSplitSchema = new Schema<IPaymentSplit>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipientRole: {
      type: String,
      enum: ['FARMER', 'VENDOR', 'TRANSPORTER', 'PLATFORM'],
      required: true,
    },
    amountKes: { type: Number, required: true, min: 0 },
    mpesaReceiptNumber: { type: String },
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
  },
  { _id: false }
);

const DispatchAttemptSchema = new Schema<IDispatchAttempt>(
  {
    driverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    vehicleClass: { type: String, required: true },
    offeredAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    wasAccepted: { type: Boolean, default: false },
    wasDeclined: { type: Boolean, default: false },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderType: {
      type: String,
      enum: Object.values(OrderType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.ESCROW_LOCKED,
    },
    campaignId: { type: Schema.Types.ObjectId, ref: 'LPOCampaign', index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedDriverId: { type: Schema.Types.ObjectId, ref: 'User' },

    commodity: { type: String, required: true },
    quantityKg: { type: Number, required: true, min: 0.1 },

    totalOrderValueKes: { type: Number, required: true, min: 1 },
    transportFeeKes: { type: Number, required: true, min: 0 },
    platformFeeKes: { type: Number, required: true, min: 0 },
    paymentSplits: { type: [PaymentSplitSchema], default: [] },

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
    distanceKm: { type: Number, required: true, min: 0 },

    loadingOtp: { type: OtpHandshakeSchema, required: true },
    deliveryOtp: { type: OtpHandshakeSchema, required: true },

    dispatchAttempts: { type: [DispatchAttemptSchema], default: [] },

    mpesaCheckoutRequestId: { type: String },
    mpesaReceiptNumber: { type: String },

    escrowLockedAt: { type: Date },
    dispatchedAt: { type: Date },
    loadedAt: { type: Date },
    deliveredAt: { type: Date },
    settledAt: { type: Date },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

OrderSchema.index({ status: 1, orderType: 1 });
OrderSchema.index({ assignedDriverId: 1, status: 1 });
OrderSchema.index({ pickupLocation: '2dsphere' });
OrderSchema.index({ deliveryLocation: '2dsphere' });

// ─── Pre-save Validation ──────────────────────────────────────────────────────

OrderSchema.pre<IOrder>('save', function (next) {
  // Invariant: B2B orders must always have a campaign reference
  if (this.orderType === OrderType.B2B_SUPPLY_CHAIN && !this.campaignId) {
    return next(new Error('B2B_SUPPLY_CHAIN orders must reference a campaignId.'));
  }
  // Invariant: B2C orders must always have a vendor reference
  if (this.orderType === OrderType.B2C_LOCAL_MARKET && !this.vendorId) {
    return next(new Error('B2C_LOCAL_MARKET orders must reference a vendorId.'));
  }
  next();
});

export const Order: Model<IOrder> = mongoose.model<IOrder>('Order', OrderSchema);