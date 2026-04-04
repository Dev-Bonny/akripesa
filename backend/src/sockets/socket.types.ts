import { UserRole } from '../models/User.model';

// ─── Authenticated Socket User ────────────────────────────────────────────────

export interface SocketUser {
  userId: string;
  role: UserRole;
  phoneNumber: string;
}

// ─── Tracking Namespace Events ────────────────────────────────────────────────

export interface DriverLocationUpdate {
  orderId: string;
  latitude: number;
  longitude: number;
  timestamp: number; // Unix ms
}

export interface TrackingRoomUpdate extends DriverLocationUpdate {
  driverName: string;
  vehicleClass: string;
  estimatedArrivalMinutes?: number;
}

// ─── Dispatch Namespace Events ────────────────────────────────────────────────

export interface DispatchOffer {
  orderId: string;
  commodity: string;
  quantityKg: number;
  pickupAddress: string;
  deliveryAddress: string;
  distanceKm: number;
  transportFeeKes: number; // whole KES for display
  vehicleClass: string;
  expiresAt: number; // Unix ms — client countdown timer
}

export interface DispatchResponse {
  orderId: string;
  accepted: boolean;
}

// ─── Investor Namespace Events ────────────────────────────────────────────────

export interface FundingProgressUpdate {
  campaignId: string;
  currentFundedAmountKes: number;
  targetAmountKes: number;
  fundingProgressPercent: number;
}

// ─── Vendor Namespace Events ──────────────────────────────────────────────────

export interface VendorOrderPing {
  orderId: string;
  consumerName: string;
  items: Array<{ name: string; quantity: number; priceKes: number }>;
  totalKes: number;
  pickupDeadlineMinutes: number;
}

export interface VendorOrderResponse {
  orderId: string;
  accepted: boolean;
  estimatedPrepMinutes?: number;
}