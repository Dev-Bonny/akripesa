'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { campaignFormSchema, CampaignFormValues } from '@/lib/validations/campaign.schema';
import { apiFetch } from '@/lib/api';
import { kesToCents } from '@/lib/utils';
import { LPOCampaign } from '@/types/api.types';

// ─── Create Campaign ──────────────────────────────────────────────────────────

export interface CreateCampaignActionState {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
  campaignId?: string;
}

/**
 * Server Action: Create a new LPO Campaign.
 */
export const createCampaignAction = async (
  _prevState: CreateCampaignActionState,
  formData: FormData
): Promise<CreateCampaignActionState> => {
  // 1. Extract and coerce form data
  const rawValues: Record<string, unknown> = {
    internalClientName:     formData.get('internalClientName'),
    internalContactName:    formData.get('internalContactName'),
    internalContactPhone:   formData.get('internalContactPhone'),
    internalContactEmail:   formData.get('internalContactEmail'),
    lpoDocumentUrl:         formData.get('lpoDocumentUrl'),
    contractValueKes:       Number(formData.get('contractValueKes')),
    expectedSettlementDate: formData.get('expectedSettlementDate'),
    internalNotes:          formData.get('internalNotes') || undefined,
    publicClientCategory:   formData.get('publicClientCategory'),
    publicHistorySummary:   formData.get('publicHistorySummary'),
    verifiedByPlatform:     formData.get('verifiedByPlatform') === 'true',
    commodity:              formData.get('commodity'),
    quantityKg:             Number(formData.get('quantityKg')),
    targetAmountKes:        Number(formData.get('targetAmountKes')),
    expectedReturnPercent:  Number(formData.get('expectedReturnPercent')),
    durationDays:           Number(formData.get('durationDays')),
    deadline:               formData.get('deadline'),
    pickupAddress:          formData.get('pickupAddress'),
    pickupLat:              Number(formData.get('pickupLat')),
    pickupLng:              Number(formData.get('pickupLng')),
    deliveryAddress:        formData.get('deliveryAddress'),
    deliveryLat:            Number(formData.get('deliveryLat')),
    deliveryLng:            Number(formData.get('deliveryLng')),
  };

  // 2. Validate with Zod
  const parsed = campaignFormSchema.safeParse(rawValues);

  if (!parsed.success) {
    return {
      success: false,
      message: 'Please fix the errors below before submitting.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const v = parsed.data;

  // 3. Transform into backend DTO (nested structure, KES → cents)
  const dto = {
    internalData: {
      clientName:              v.internalClientName,
      clientContact: {
        name:  v.internalContactName,
        phone: v.internalContactPhone,
        email: v.internalContactEmail,
      },
      lpoDocumentUrl:          v.lpoDocumentUrl,
      contractValue:           kesToCents(v.contractValueKes),
      expectedSettlementDate:  v.expectedSettlementDate,
      internalNotes:           v.internalNotes,
    },
    publicData: {
      category:          v.publicClientCategory,
      historySummary:    v.publicHistorySummary,
      verifiedByPlatform: v.verifiedByPlatform,
    },
    commodity:              v.commodity,
    quantityKg:             v.quantityKg,
    targetAmountKes:        kesToCents(v.targetAmountKes),
    expectedReturnPercent:  v.expectedReturnPercent,
    durationDays:           v.durationDays,
    deadline:               v.deadline,
    pickupLocation: {
      coordinates: [v.pickupLng, v.pickupLat] as [number, number],
      address:     v.pickupAddress,
    },
    deliveryLocation: {
      coordinates: [v.deliveryLng, v.deliveryLat] as [number, number],
      address:     v.deliveryAddress,
    },
  };

  
  // 4. Call backend API (FIXED ROUTE)
  const response = await apiFetch<{ _id: string }>('/campaigns', {
    method: 'POST',
    body: JSON.stringify(dto),
  });

  if (!response.success) {
    return {
      success: false,
      message: response.message ?? 'Failed to create campaign.',
      fieldErrors: response.errors,
    };
  }

  // 5. Revalidate the campaigns list and redirect to the new campaign
  revalidatePath('/admin/campaigns');

  return {
    success: true,
    message: 'Campaign created successfully as DRAFT.',
    campaignId: response.data._id,
  };
};

// ─── Fetch Campaigns (Server Component data fetch) ───────────────────────────

export const fetchAdminCampaigns = async (params?: {
  status?: string;
  page?: number;
}): Promise<{ campaigns: LPOCampaign[]; total: number; pages: number }> => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.page)   query.set('page', String(params.page));

  // FIXED ROUTE
  const response = await apiFetch<{
    campaigns: LPOCampaign[];
    total: number;
    pages: number;
  }>(`/campaigns/admin/all?${query.toString()}`);

  if (!response.success) return { campaigns: [], total: 0, pages: 0 };
  return response.data;
};

// ─── Platform Capital Injection ───────────────────────────────────────────────

export interface InjectionActionState {
  success: boolean;
  message: string;
  injectedAmountKes?: number;
}

export const injectPlatformCapitalAction = async (
  campaignId: string
): Promise<InjectionActionState> => {
  // FIXED ROUTE
  const response = await apiFetch<{
    injectedAmountKes: number;
    bankTransactionRef: string;
  }>(`/campaigns/${campaignId}/inject`, {
    method: 'POST',
  });

  if (!response.success) {
    return { success: false, message: response.message };
  }

  revalidatePath('/admin/campaigns');
  return {
    success: true,
    message: `Platform injection successful.`,
    injectedAmountKes: response.data.injectedAmountKes,
  };
};

// ─── Retry Failed Payout ──────────────────────────────────────────────────────

export const retryPayoutAction = async (
  investmentId: string
): Promise<{ success: boolean; message: string }> => {
  // FIXED ROUTE
  const response = await apiFetch(
    `/campaigns/investments/${investmentId}/retry-payout`,
    { method: 'POST' }
  );

  revalidatePath('/admin/payouts');
  return {
    success: response.success,
    message: response.message,
  };
};

// ─── Fetch all campaigns for admin table ─────────────────────────────────────

export interface AdminCampaignRow extends LPOCampaign {
  isUrgent: boolean;      
  hoursToDeadline: number;
}

export const fetchAdminCampaignsTable = async (): Promise<AdminCampaignRow[]> => {
  // FIXED ROUTE
  const response = await apiFetch<LPOCampaign[]>('/campaigns/admin/all');

  if (!response.success) return [];

  const now = Date.now();
  const fortyEightHours = 48 * 60 * 60 * 1000;

  return response.data.map((campaign) => {
    const deadline = new Date(campaign.deadline).getTime();
    const hoursToDeadline = Math.max(
      0,
      Math.floor((deadline - now) / (1000 * 60 * 60))
    );
    const isUrgent =
      campaign.fundingProgressPercent < 100 &&
      deadline - now < fortyEightHours &&
      deadline > now &&
      (campaign.status === 'FUNDING' ||
        campaign.status === 'AWAITING_PLATFORM_FILL');

    return { ...campaign, isUrgent, hoursToDeadline };
  });
};

// ─── Publish campaign ─────────────────────────────────────────────────────────

export const publishCampaignAction = async (
  campaignId: string
): Promise<{ success: boolean; message: string }> => {
  // FIXED ROUTE
  const response = await apiFetch(
    `/campaigns/${campaignId}/publish`,
    { method: 'POST' }
  );
  revalidatePath('/admin/campaigns');
  return { success: response.success, message: response.message };
};