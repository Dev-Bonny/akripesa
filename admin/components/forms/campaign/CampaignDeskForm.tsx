'use client';

import { useEffect } from 'react';
import { useFormState } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import {
  campaignFormSchema,
  CampaignFormValues,
} from '@/lib/validations/campaign.schema';
import {
  createCampaignAction,
  CreateCampaignActionState,
} from '@/actions/campaign.actions';
import { InternalDataSection } from './InternalDataSection';
import { PublicDataSection } from './PublicDataSection';
import { FinancialsSection } from './FinancialsSection';
import { Button } from '@/components/ui/button';

const initialState: CreateCampaignActionState = {
  success: false,
  message: '',
};

export const CampaignDeskForm = () => {
  const router = useRouter();

  const [actionState, formAction] = useFormState(
    createCampaignAction,
    initialState
  );
  const isPending = false; // Prevents button errors in React 18

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      verifiedByPlatform: false,
      durationDays: 30,
      expectedReturnPercent: 5,
    },
    mode: 'onBlur', // Validate on blur — less aggressive than onChange for a long form
  });

  // Handle server action response
  useEffect(() => {
    if (!actionState.message) return;

    if (actionState.success) {
      toast.success(actionState.message);
      router.push(`/admin/campaigns/${actionState.campaignId}`);
    } else if (actionState.fieldErrors) {
      // Hydrate React Hook Form errors from server-side Zod validation
      Object.entries(actionState.fieldErrors).forEach(([field, messages]) => {
        form.setError(field as keyof CampaignFormValues, {
          type: 'server',
          message: messages[0],
        });
      });
      toast.error(actionState.message);
    } else {
      toast.error(actionState.message);
    }
  }, [actionState]);

  /**
   * Form submission handler.
   * React Hook Form validates client-side first (Zod).
   * On success, serialises to FormData for the Server Action.
   * Server Action re-validates server-side before calling the API.
   */
  const handleSubmit = form.handleSubmit((values: CampaignFormValues) => {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.set(key, String(value));
      }
    });
    formAction(formData);
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/campaigns"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-brand-600" />
              <h1 className="text-xl font-bold text-slate-900">
                Campaign Desk
              </h1>
            </div>
            <p className="text-sm text-slate-500">
              Digitize a new offline LPO contract into a fundable campaign.
              The campaign is saved as{' '}
              <span className="font-medium text-amber-700">DRAFT</span>{' '}
              — you must publish it separately to go live.
            </p>
          </div>
        </div>
      </div>

      {/* Top-level form error */}
      {!actionState.success && actionState.message && !actionState.fieldErrors && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{actionState.message}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/*
         * Section 1: Internal (Admin-only)
         * Amber border — signals confidential data
         */}
        <InternalDataSection form={form} />

        {/*
         * Section 2: Public (Investor-facing)
         * Green border — signals this is the sanitized tranche profile
         */}
        <PublicDataSection form={form} />

        {/*
         * Section 3: Financials and Logistics
         * Neutral — campaign mechanics visible to both admin layers
         */}
        <FinancialsSection form={form} />

        {/* Form Actions */}
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-6 py-4">
          <p className="text-sm text-slate-500">
            Campaign will be created as{' '}
            <span className="font-semibold text-amber-700">DRAFT</span>.
            You can review and publish from the Campaigns table.
          </p>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/admin/campaigns')}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isPending} disabled={isPending}>
              {isPending ? 'Creating Campaign…' : 'Create Campaign as Draft'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};