'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { apiFetch } from '@/lib/api';
import { Investment } from '@/types/api.types';

// ─── Schema ───────────────────────────────────────────────────────────────────

const pledgeSchema = z.object({
  campaignId: z.string().min(1),
  amountInvestedKes: z
    .number()
    .min(10000, 'Minimum investment is KES 100')
    .max(100_000_00, 'Maximum single investment is KES 1,000,000'),
  phoneNumber: z
    .string()
    .regex(/^2547\d{8}$/, 'Format: 2547XXXXXXXX'),
});

// ─── State ────────────────────────────────────────────────────────────────────

export interface PledgeActionState {
  success: boolean;
  message: string;
  investmentId?: string;
  fieldErrors?: Record<string, string[]>;
}

// ─── Pledge Investment ────────────────────────────────────────────────────────

export const pledgeInvestmentAction = async (
  _prev: PledgeActionState,
  formData: FormData
): Promise<PledgeActionState> => {
  const parsed = pledgeSchema.safeParse({
    campaignId:        formData.get('campaignId'),
    amountInvestedKes: Number(formData.get('amountInvestedKes')),
    phoneNumber:       formData.get('phoneNumber'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Please fix the errors below.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const response = await apiFetch<{ investmentId: string }>(
    '/investments/pledge',
    {
      method: 'POST',
      body: JSON.stringify({
        campaignId:        parsed.data.campaignId,
        amountInvestedKes: parsed.data.amountInvestedKes,
      }),
    }
  );

  if (!response.success) {
    return { success: false, message: response.message };
  }

  revalidatePath('/portfolio');
  return {
    success: true,
    message: 'M-Pesa STK Push sent. Check your phone to confirm payment.',
    investmentId: response.data.investmentId,
  };
};

// ─── Poll Investment Status ───────────────────────────────────────────────────

export const fetchInvestmentStatus = async (
  investmentId: string
): Promise<{ status: string; payoutStatus: string } | null> => {
  const response = await apiFetch<Investment>(
    `/investments/${investmentId}/status`
  );
  if (!response.success) return null;
  return {
    status:       response.data.status,
    payoutStatus: response.data.payoutStatus,
  };
};

// ─── Investor Portfolio ───────────────────────────────────────────────────────

export const fetchMyPortfolio = async (): Promise<Investment[]> => {
  const response = await apiFetch<Investment[]>('/investments/my-portfolio');
  if (!response.success) return [];
  return response.data;
};