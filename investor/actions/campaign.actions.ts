'use server';

import { apiFetch } from '@/lib/api';
import { LPOCampaign } from '@/types/api.types';

export const fetchFundingCampaigns = async (
  commodity?: string
): Promise<LPOCampaign[]> => {
  const query = commodity ? `?commodity=${commodity}` : '';
  const response = await apiFetch<LPOCampaign[]>(`/campaigns${query}`);
  if (!response.success) return [];
  // Backend sanitizer already stripped internalData
  return response.data;
};

export const fetchCampaignById = async (
  campaignId: string
): Promise<LPOCampaign | null> => {
  const response = await apiFetch<LPOCampaign>(`/campaigns/${campaignId}`);
  if (!response.success) return null;
  return response.data;
};