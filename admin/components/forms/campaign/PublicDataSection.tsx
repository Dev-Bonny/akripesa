'use client';

import { UseFormReturn, Controller } from 'react-hook-form';
import { Eye } from 'lucide-react';
import { CampaignFormValues } from '@/lib/validations/campaign.schema';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  form: UseFormReturn<CampaignFormValues>;
}

const PUBLIC_CATEGORIES = [
  'Tier-1 Private Hospital',
  'Tier-2 Public Hospital',
  'National Boarding School',
  'County Boarding School',
  'Hotel Chain',
  'Supermarket Chain',
  'Government Institution',
  'Food Processor',
] as const;

/**
 * INVESTOR-FACING section.
 * Green border and eye icon signal this is the sanitized public profile.
 * Admins see both sections simultaneously — the visual contrast prevents
 * accidentally entering confidential data in the wrong section.
 */
export const PublicDataSection = ({ form }: Props) => {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="rounded-lg border-2 border-brand-300 bg-brand-50 p-6">
      {/* Section Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100">
          <Eye className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <h3 className="font-semibold text-brand-900">
            Public Tranche Profile — Investor Facing
          </h3>
          <p className="text-xs text-brand-700">
            This anonymized profile is what retail investors see on the
            Investor App. Never include the institution&apos;s real name here.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Public Category */}
        <div>
          <Label htmlFor="publicClientCategory" className="text-brand-900">
            Institution Category <span className="text-red-500">*</span>
          </Label>
          <Controller
            name="publicClientCategory"
            control={control}
            render={({ field }) => (
              <select
                id="publicClientCategory"
                className="mt-1 flex h-10 w-full rounded-md border border-brand-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                value={field.value}
                onChange={field.onChange}
              >
                <option value="" disabled>
                  Select a category…
                </option>
                {PUBLIC_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
          />
          {errors.publicClientCategory && (
            <p className="mt-1 text-xs text-red-600">
              {errors.publicClientCategory.message}
            </p>
          )}
        </div>

        {/* Verified Badge Toggle */}
        <div className="flex flex-col justify-end">
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-brand-200 bg-white p-3">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-brand-300 text-brand-600"
              {...register('verifiedByPlatform')}
            />
            <div>
              <span className="text-sm font-medium text-brand-900">
                Mark as Verified by Akripesa
              </span>
              <p className="text-xs text-brand-600">
                Displays a verification badge on the investor tranche card.
              </p>
            </div>
          </label>
        </div>

        {/* History Summary */}
        <div className="md:col-span-2">
          <Label htmlFor="publicHistorySummary" className="text-brand-900">
            Public Trust Profile <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="publicHistorySummary"
            rows={3}
            placeholder="e.g., 100% on-time repayment rate across 3 prior contracts. Established 2009."
            className="mt-1 border-brand-300 bg-white focus-visible:ring-brand-500"
            {...register('publicHistorySummary')}
          />
          {errors.publicHistorySummary && (
            <p className="mt-1 text-xs text-red-600">
              {errors.publicHistorySummary.message}
            </p>
          )}
          <p className="mt-1 text-xs text-brand-700">
            {form.watch('publicHistorySummary')?.length ?? 0} / 300 characters
          </p>
        </div>
      </div>
    </div>
  );
};