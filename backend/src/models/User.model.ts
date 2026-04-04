import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  RETAIL_INVESTOR = 'RETAIL_INVESTOR',
  FARMER = 'FARMER',
  TRANSPORTER = 'TRANSPORTER',
  CONSUMER = 'CONSUMER',
  VENDOR = 'VENDOR',
  BULK_BROKER = 'BULK_BROKER',
  PLATFORM_SYSTEM = 'PLATFORM_SYSTEM', // Reserved for underwriting injections
}

export enum VehicleClass {
  BODA = 'BODA',
  PICKUP = 'PICKUP',
  CANTER = 'CANTER',
  FRR_TRUCK = 'FRR_TRUCK',
}

export enum KYCStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

// ─── Sub-document Interfaces ─────────────────────────────────────────────────

interface IMpesaWallet {
  phoneNumber: string;       // Format: 2547XXXXXXXX
  totalDeposited: number;    // Lifetime deposits (KES, in cents to avoid float errors)
  totalWithdrawn: number;
  currentBalance: number;
}

interface ITransporterProfile {
  vehicleClass: VehicleClass;
  vehicleRegistration: string;
  isAvailable: boolean;
  currentLocation?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  totalDeliveries: number;
  rating: number; // 0.00 - 5.00
}

interface IFarmerProfile {
  county: string;
  subCounty: string;
  primaryCommodities: string[];
  farmSizeAcres?: number;
  isUSSDUser: boolean; // Determines USSD vs PWA routing
}

// ─── Main Interface ───────────────────────────────────────────────────────────

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  fullName: string;
  phoneNumber: string;        // Primary identifier (2547XXXXXXXX)
  email?: string;
  passwordHash: string;
  role: UserRole;
  kycStatus: KYCStatus;
  nationalIdNumber?: string;  // select: false
  mpesaWallet: IMpesaWallet;
  transporterProfile?: ITransporterProfile;
  farmerProfile?: IFarmerProfile;
  isActive: boolean;
  lastLoginAt?: Date;
  refreshTokenHash?: string;  // select: false — stores hashed refresh token
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const MpesaWalletSchema = new Schema<IMpesaWallet>(
  {
    phoneNumber: { type: String, required: true },
    totalDeposited: { type: Number, default: 0, min: 0 },
    totalWithdrawn: { type: Number, default: 0, min: 0 },
    currentBalance: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const TransporterProfileSchema = new Schema<ITransporterProfile>(
  {
    vehicleClass: { type: String, enum: Object.values(VehicleClass), required: true },
    vehicleRegistration: { type: String, required: true, uppercase: true, trim: true },
    isAvailable: { type: Boolean, default: true },
    currentLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], index: '2dsphere' },
    },
    totalDeliveries: { type: Number, default: 0 },
    rating: { type: Number, default: 5.0, min: 0, max: 5 },
  },
  { _id: false }
);

const FarmerProfileSchema = new Schema<IFarmerProfile>(
  {
    county: { type: String, required: true },
    subCounty: { type: String, required: true },
    primaryCommodities: { type: [String], default: [] },
    farmSizeAcres: { type: Number, min: 0 },
    isUSSDUser: { type: Boolean, default: false },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^2547\d{8}$/, 'Phone number must be in format 2547XXXXXXXX'],
    },
    email: {
      type: String,
      sparse: true, // allows multiple null values on a unique index
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
      default: UserRole.RETAIL_INVESTOR,
    },
    kycStatus: {
      type: String,
      enum: Object.values(KYCStatus),
      default: KYCStatus.PENDING,
    },
    nationalIdNumber: { type: String, select: false, sparse: true, unique: true },
    mpesaWallet: { type: MpesaWalletSchema, required: true },
    transporterProfile: { type: TransporterProfileSchema },
    farmerProfile: { type: FarmerProfileSchema },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    refreshTokenHash: { type: String, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      // Ensure passwordHash never leaks into JSON serialization
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.refreshTokenHash;
        delete ret.nationalIdNumber;
        return ret;
      },
    },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ 'transporterProfile.currentLocation': '2dsphere' });
UserSchema.index({ 'transporterProfile.vehicleClass': 1, 'transporterProfile.isAvailable': 1 });

// ─── Pre-save Hook ────────────────────────────────────────────────────────────

UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  // Must explicitly select passwordHash when calling comparePassword
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);