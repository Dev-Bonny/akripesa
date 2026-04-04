'use client';

import { CampaignPayoutSummary } from '@/actions/payout.actions';
import { PayoutStatusBadge } from '@/components/admin/PayoutStatusBadge';
import { CampaignStatusBadge } from '@/components/admin/CampaignStatusBadge';
import { formatKes, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  summaries: CampaignPayoutSummary[];
}

export const PayoutQueueTable = ({ summaries }: Props) => {
  if (summaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-16">
        <CheckCircle2 className="h-10 w-10 text-slate-300" />
        <p className="mt-3 text-sm text-slate-400">
          No active payout queues.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {summaries.map((summary) => (
        <div
          key={summary.campaign._id}
          className={cn(
            'overflow-hidden rounded-lg border bg-white shadow-sm',
            summary.campaign.hasPayoutFailures
              ? 'border-red-200'
              : 'border-slate-200'
          )}
        >
          {/* Campaign header */}
          <div
            className={cn(
              'flex items-center justify-between px-4 py-3',
              summary.campaign.hasPayoutFailures
                ? 'bg-red-50 border-b border-red-100'
                : 'bg-slate-50 border-b border-slate-100'
            )}
          >
            <div className="flex items-center gap-3">
              {summary.campaign.hasPayoutFailures && (
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {summary.campaign.commodity.charAt(0) +
                    summary.campaign.commodity.slice(1).toLowerCase()}{' '}
                  — {summary.campaign.publicData.category}
                </p>
                <p className="font-mono text-xs text-slate-400">
                  {summary.campaign._id}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Payout progress pills */}
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-brand-700">
                  ✓ {summary.successCount} paid
                </span>
                {summary.pendingCount > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">
                    ⏳ {summary.pendingCount} pending
                  </span>
                )}
                {summary.manualHoldCount > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-red-700">
                    ⚠ {summary.manualHoldCount} held
                  </span>
                )}
              </div>
              <CampaignStatusBadge status={summary.campaign.status} />
            </div>
          </div>

          {/* Per-investor rows */}
          <div className="divide-y divide-slate-50">
            {summary.investments.map((inv) => (
              <div
                key={inv._id}
                className={cn(
                  'flex items-center justify-between px-4 py-2.5',
                  inv.payoutStatus === 'MANUAL_HOLD' && 'bg-red-50/50',
                  inv.payoutStatus === 'SUCCESS' && 'opacity-60'
                )}
              >
                <div className="flex items-center gap-3">
                  <PayoutStatusBadge status={inv.payoutStatus} />
                  <span className="font-mono text-xs text-slate-400">
                    {inv._id.slice(-8)}
                  </span>
                  <span className="text-xs text-slate-500 capitalize">
                    {inv.investorType.toLowerCase()}
                  </span>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-xs text-slate-400">Principal</p>
                    <p className="text-sm font-medium">
                      {formatKes(inv.amountInvestedKes)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Payout</p>
                    <p className="text-sm font-semibold text-brand-700">
                      {formatKes(inv.expectedPayoutKes)}
                    </p>
                  </div>
                  {inv.payoutMpesaReceiptNumber && (
                    <div>
                      <p className="text-xs text-slate-400">M-Pesa Ref</p>
                      <p className="font-mono text-xs text-slate-600">
                        {inv.payoutMpesaReceiptNumber}
                      </p>
                    </div>
                  )}
                  {inv.paidOutAt && (
                    <div>
                      <p className="text-xs text-slate-400">Paid</p>
                      <p className="text-xs text-slate-600">
                        {formatDate(inv.paidOutAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};