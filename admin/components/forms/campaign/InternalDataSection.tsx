'use client';

import { UseFormReturn } from 'react-hook-form';
import { ShieldAlert } from 'lucide-react';
import { CampaignFormValues } from '@/lib/validations/campaign.schema';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Props {
  form: UseFormReturn<CampaignFormValues>;
}

/**
 * ADMIN-EYES-ONLY section.
 *
 * Visual design deliberately distinguishes this section from the
 * public section: amber border, lock icon, muted background.
 * This makes it immediately clear to the admin which fields
 * are confidential and never shown to investors.
 */
export const InternalDataSection = ({ form }: Props) => {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-6">
      {/* Section Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
          <ShieldAlert className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h3 className="font-semibold text-amber-900">
            Confidential — Internal Use Only
          </h3>
          <p className="text-xs text-amber-700">
            These fields are never visible to investors or the public.
            They are stored with encryption and excluded from all
            investor-facing API responses.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Real Client Name */}
        <div className="md:col-span-2">
          <Label
            htmlFor="internalClientName"
            className="text-amber-900"
          >
            Actual Institution Name
            <span className="ml-1 text-red-500">*</span>
          </Label>
          <Input
            id="internalClientName"
            placeholder="e.g., Nairobi Hospital, Alliance High School"
            className="mt-1 border-amber-300 bg-white focus-visible:ring-amber-500"
            error={errors.internalClientName?.message}
            {...register('internalClientName')}
          />
        </div>

        {/* Contact Name */}
        <div>
          <Label htmlFor="internalContactName" className="text-amber-900">
            Contact Person <span className="text-red-500">*</span>
          </Label>
          <Input
            id="internalContactName"
            placeholder="Full name"
            className="mt-1 border-amber-300 bg-white focus-visible:ring-amber-500"
            error={errors.internalContactName?.message}
            {...register('internalContactName')}
          />
        </div>

        {/* Contact Phone */}
        <div>
          <Label htmlFor="internalContactPhone" className="text-amber-900">
            Contact Phone <span className="text-red-500">*</span>
          </Label>
          <Input
            id="internalContactPhone"
            placeholder="2547XXXXXXXX"
            className="mt-1 border-amber-300 bg-white focus-visible:ring-amber-500"
            error={errors.internalContactPhone?.message}
            {...register('internalContactPhone')}
          />
        </div>

        {/* Contact Email */}
        <div>
          <Label htmlFor="internalContactEmail" className="text-amber-900">
            Contact Email <span className="text-red-500">*</span>
          </Label>
          <Input
            id="internalContactEmail"
            type="email"
            placeholder="procurement@institution.ac.ke"
            className="mt-1 border-amber-300 bg-white focus-visible:ring-amber-500"
            error={errors.internalContactEmail?.message}
            {...register('internalContactEmail')}
          />
        </div>

        {/* Contract Value */}
        <div>
          <Label htmlFor="contractValueKes" className="text-amber-900">
            Full Contract Value (KES) <span className="text-red-500">*</span>
          </Label>
          <div className="relative mt-1">
            <span className="absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">
              KES
            </span>
            <Input
              id="contractValueKes"
              type="number"
              placeholder="2,000,000"
              className="border-amber-300 bg-white pl-12 focus-visible:ring-amber-500"
              error={errors.contractValueKes?.message}
              {...register('contractValueKes', { valueAsNumber: true })}
            />
          </div>
          <p className="mt-1 text-xs text-amber-700">
            The amount the institution will wire to Akripesa upon delivery.
          </p>
        </div>

        {/* Expected Settlement Date */}
        <div>
          <Label htmlFor="expectedSettlementDate" className="text-amber-900">
            Expected Settlement Date <span className="text-red-500">*</span>
          </Label>
          <Input
            id="expectedSettlementDate"
            type="date"
            className="mt-1 border-amber-300 bg-white focus-visible:ring-amber-500"
            error={errors.expectedSettlementDate?.message}
            {...register('expectedSettlementDate')}
          />
        </div>

        {/* LPO Document URL */}
        <div className="md:col-span-2">
          <Label htmlFor="lpoDocumentUrl" className="text-amber-900">
            LPO Document URL <span className="text-red-500">*</span>
          </Label>
          <Input
            id="lpoDocumentUrl"
            type="url"
            placeholder="https://storage.akripesa.com/lpos/signed-lpo-2024.pdf"
            className="mt-1 border-amber-300 bg-white focus-visible:ring-amber-500"
            error={errors.lpoDocumentUrl?.message}
            {...register('lpoDocumentUrl')}
          />
          <p className="mt-1 text-xs text-amber-700">
            Upload the signed LPO to secure storage first, then paste the URL here.
          </p>
        </div>

        {/* Internal Notes */}
        <div className="md:col-span-2">
          <Label htmlFor="internalNotes" className="text-amber-900">
            Internal Notes (optional)
          </Label>
          <Textarea
            id="internalNotes"
            rows={3}
            placeholder="Relationship history, payment terms, special handling notes..."
            className="mt-1 border-amber-300 bg-white focus-visible:ring-amber-500"
            {...register('internalNotes')}
          />
          {errors.internalNotes && (
            <p className="mt-1 text-xs text-red-600">
              {errors.internalNotes.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};