'use client';

import { UseFormReturn, Controller } from 'react-hook-form';
import { TrendingUp, MapPin } from 'lucide-react';
import { CampaignFormValues } from '@/lib/validations/campaign.schema';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatKes } from '@/lib/utils';

interface Props {
  form: UseFormReturn<CampaignFormValues>;
}

const COMMODITIES = [
  'MAIZE', 'POTATOES', 'BEANS', 'TOMATOES', 'ONIONS',
  'CABBAGES', 'KALES', 'RICE', 'WHEAT', 'SORGHUM',
] as const;

export const FinancialsSection = ({ form }: Props) => {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;

  const contractValue  = watch('contractValueKes') ?? 0;
  const targetAmount   = watch('targetAmountKes')  ?? 0;
  const returnPercent  = watch('expectedReturnPercent') ?? 0;
  const grossMargin    = contractValue - targetAmount;
  const isMarginValid  = grossMargin > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
          <TrendingUp className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">
            Campaign Financials & Logistics
          </h3>
          <p className="text-xs text-slate-500">
            Crowdfunding target, investor returns, produce details and locations.
          </p>
        </div>
      </div>

      {/* Live Gross Margin Indicator */}
      {contractValue > 0 && targetAmount > 0 && (
        <div
          className={`mb-6 rounded-md border p-4 ${
            isMarginValid
              ? 'border-green-200 bg-green-50'
              : 'border-red-200 bg-red-50'
          }`}
        >
          <p
            className={`text-sm font-medium ${
              isMarginValid ? 'text-green-800' : 'text-red-800'
            }`}
          >
            {isMarginValid
              ? `✓ Platform Gross Margin: ${formatKes(grossMargin * 100)} (${(
                  (grossMargin / contractValue) *
                  100
                ).toFixed(1)}% of contract)`
              : '✗ Target amount must be less than contract value. The spread is platform revenue.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {/* Commodity */}
        <div>
          <Label htmlFor="commodity">
            Commodity <span className="text-red-500">*</span>
          </Label>
          <Controller
            name="commodity"
            control={control}
            render={({ field }) => (
              <select
                id="commodity"
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                value={field.value}
                onChange={field.onChange}
              >
                <option value="" disabled>
                  Select commodity…
                </option>
                {COMMODITIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0) + c.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            )}
          />
          {errors.commodity && (
            <p className="mt-1 text-xs text-red-600">{errors.commodity.message}</p>
          )}
        </div>

        {/* Quantity */}
        <div>
          <Label htmlFor="quantityKg">
            Quantity (kg) <span className="text-red-500">*</span>
          </Label>
          <div className="relative mt-1">
            <Input
              id="quantityKg"
              type="number"
              placeholder="5000"
              error={errors.quantityKg?.message}
              {...register('quantityKg', { valueAsNumber: true })}
            />
            <span className="absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
              kg
            </span>
          </div>
        </div>

        {/* Crowdfunding Target */}
        <div>
          <Label htmlFor="targetAmountKes">
            Crowdfunding Target (KES) <span className="text-red-500">*</span>
          </Label>
          <div className="relative mt-1">
            <span className="absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">
              KES
            </span>
            <Input
              id="targetAmountKes"
              type="number"
              placeholder="1,500,000"
              className="pl-12"
              error={errors.targetAmountKes?.message}
              {...register('targetAmountKes', { valueAsNumber: true })}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            The amount shown to investors. Less than the contract value.
          </p>
        </div>

        {/* Expected Return */}
        <div>
          <Label htmlFor="expectedReturnPercent">
            Investor ROI (%) <span className="text-red-500">*</span>
          </Label>
          <div className="relative mt-1">
            <Input
              id="expectedReturnPercent"
              type="number"
              step="0.01"
              placeholder="5.00"
              error={errors.expectedReturnPercent?.message}
              {...register('expectedReturnPercent', { valueAsNumber: true })}
            />
            <span className="absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
              %
            </span>
          </div>
          {returnPercent > 0 && targetAmount > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Investor payout pool:{' '}
              {formatKes((targetAmount * returnPercent) / 100 * 100)}
            </p>
          )}
        </div>

        {/* Duration */}
        <div>
          <Label htmlFor="durationDays">
            Duration (days) <span className="text-red-500">*</span>
          </Label>
          <div className="relative mt-1">
            <Input
              id="durationDays"
              type="number"
              placeholder="30"
              error={errors.durationDays?.message}
              {...register('durationDays', { valueAsNumber: true })}
            />
            <span className="absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
              days
            </span>
          </div>
        </div>

        {/* Funding Deadline */}
        <div>
          <Label htmlFor="deadline">
            Funding Deadline <span className="text-red-500">*</span>
          </Label>
          <Input
            id="deadline"
            type="datetime-local"
            className="mt-1"
            error={errors.deadline?.message}
            {...register('deadline')}
          />
        </div>
      </div>

      {/* Locations */}
      <div className="mt-6 border-t border-slate-100 pt-6">
        <div className="mb-4 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-500" />
          <h4 className="text-sm font-semibold text-slate-700">
            Pickup & Delivery Locations
          </h4>
          <p className="text-xs text-slate-400">
            (Sprint 7 will add a map picker — enter coordinates manually for now)
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Pickup */}
          <div className="space-y-3 rounded-md border border-slate-100 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pickup (Farm)
            </p>
            <div>
              <Label htmlFor="pickupAddress">Address</Label>
              <Input
                id="pickupAddress"
                placeholder="e.g., Molo, Nakuru County"
                className="mt-1"
                error={errors.pickupAddress?.message}
                {...register('pickupAddress')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pickupLat">Latitude</Label>
                <Input
                  id="pickupLat"
                  type="number"
                  step="any"
                  placeholder="-0.2470"
                  className="mt-1"
                  error={errors.pickupLat?.message}
                  {...register('pickupLat', { valueAsNumber: true })}
                />
              </div>
              <div>
                <Label htmlFor="pickupLng">Longitude</Label>
                <Input
                  id="pickupLng"
                  type="number"
                  step="any"
                  placeholder="35.7172"
                  className="mt-1"
                  error={errors.pickupLng?.message}
                  {...register('pickupLng', { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          {/* Delivery */}
          <div className="space-y-3 rounded-md border border-slate-100 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Delivery (Institution)
            </p>
            <div>
              <Label htmlFor="deliveryAddress">Address</Label>
              <Input
                id="deliveryAddress"
                placeholder="e.g., Upper Hill, Nairobi"
                className="mt-1"
                error={errors.deliveryAddress?.message}
                {...register('deliveryAddress')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="deliveryLat">Latitude</Label>
                <Input
                  id="deliveryLat"
                  type="number"
                  step="any"
                  placeholder="-1.2921"
                  className="mt-1"
                  error={errors.deliveryLat?.message}
                  {...register('deliveryLat', { valueAsNumber: true })}
                />
              </div>
              <div>
                <Label htmlFor="deliveryLng">Longitude</Label>
                <Input
                  id="deliveryLng"
                  type="number"
                  step="any"
                  placeholder="36.8219"
                  className="mt-1"
                  error={errors.deliveryLng?.message}
                  {...register('deliveryLng', { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};