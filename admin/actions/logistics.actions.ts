'use server';

import { apiFetch } from '@/lib/api';
import { Order } from '@/types/api.types';

export interface EnrichedOrder extends Order {
  isAwaitingDriver: boolean;
  dispatchAttemptCount: number;
  vehicleClassUsed?: string;
}

export const fetchActiveOrders = async (): Promise<EnrichedOrder[]> => {
  const response = await apiFetch<Order[]>('/orders/admin/active');
  if (!response.success) return [];

  return response.data.map((order) => ({
    ...order,
    isAwaitingDriver: order.status === 'AWAITING_DRIVER',
    dispatchAttemptCount: order.dispatchAttempts?.length ?? 0,
    vehicleClassUsed: order.dispatchAttempts?.[0]?.vehicleClass,
  }));
};

export const rerouteOrderAction = async (
  orderId: string
): Promise<{ success: boolean; message: string }> => {
  const response = await apiFetch(`/orders/${orderId}/reroute`, {
    method: 'POST',
  });
  return { success: response.success, message: response.message };
};