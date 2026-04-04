'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { Investment, LPOCampaign } from '@/types/api.types';

export interface CampaignPayoutSummary {
  campaign: Pick<
    LPOCampaign,
    '_id' | 'commodity' | 'publicData' | 'status' | 'hasPayoutFailures' | 'targetAmountKes'
  >;
  investments: Investment[];
  totalInvestors: number;
  successCount: number;
  pendingCount: number;
  failedCount: number;
  manualHoldCount: number;
}

export const fetchPayoutSummaries = async (): Promise<CampaignPayoutSummary[]> => {
  const response = await apiFetch<CampaignPayoutSummary[]>(
    '/campaigns/admin/payout-summaries'
  );
  if (!response.success) return [];
  return response.data;
};

export const fetchManualHoldInvestments = async (): Promise<Investment[]> => {
  const response = await apiFetch<Investment[]>(
    '/campaigns/investments/manual-hold'
  );
  if (!response.success) return [];
  return response.data;
};

export const retryPayoutAction = async (
  investmentId: string
): Promise<{ success: boolean; message: string }> => {
  const response = await apiFetch(
    `/campaigns/investments/${investmentId}/retry-payout`,
    { method: 'POST' }
  );
  revalidatePath('/admin/payouts');
  return { success: response.success, message: response.message };
};