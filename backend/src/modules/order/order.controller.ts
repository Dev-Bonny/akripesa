import { Request, Response, NextFunction } from 'express';
import * as OrderService from './order.service';
import { sendSuccess } from '../../utils/apiResponse';

export const createB2BOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const order = await OrderService.createB2BOrder(req.body, req.user!.userId);

    // Return only the order ID and status — never the full order document
    // to prevent any OTP-adjacent data from leaking into admin UI responses
    sendSuccess(res, 201, 'B2B order created. Dispatch initiated. OTPs sent to source and buyer parties.', {
      orderId: order._id,
      status: order.status,
      commodity: order.commodity,
      quantityKg: order.quantityKg,
      distanceKm: order.distanceKm,
      transportFeeKes: order.transportFeeKes / 100,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * TRANSPORTER-only endpoint.
 * Response is strictly limited to status transition confirmation.
 * No order financials, no OTP fields, no buyer/seller details.
 */
export const verifyLoading = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await OrderService.verifyLoadingOtp(
      req.params.orderId,
      req.user!.userId,
      req.body.otp
    );

    sendSuccess(res, 200, 'Pickup confirmed. Order is now IN_TRANSIT.', result);
  } catch (err) {
    next(err);
  }
};

/**
 * TRANSPORTER-only endpoint.
 * Response is strictly limited to status transition confirmation.
 */
export const verifyDelivery = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await OrderService.verifyDeliveryOtp(
      req.params.orderId,
      req.user!.userId,
      req.body.otp
    );

    sendSuccess(res, 200, 'Delivery confirmed. Order marked DELIVERED.', result);
  } catch (err) {
    next(err);
  }
};

// ─── NEW ADMIN CONTROLLERS ADDED BELOW ────────────────────────────────────────

export const getActiveOrders = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const orders = await OrderService.getActiveOrdersForAdmin();
    sendSuccess(res, 200, 'Active orders retrieved.', orders);
  } catch (err) {
    next(err);
  }
};

export const rerouteOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const order = await OrderService.rerouteOrder(req.params.orderId);
    sendSuccess(res, 200, 'Order re-routed. Dispatch cascade restarted.', {
      orderId: order._id,
      status: order.status,
    });
  } catch (err) {
    next(err);
  }
};