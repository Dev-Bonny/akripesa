'use client';

import { useState, useTransition } from 'react';
import { AlertOctagon, RefreshCw, Phone, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Investment } from '@/types/api.types';
import { retryPayoutAction } from '@/actions/payout.actions';
import { PayoutStatusBadge } from '@/components/admin/PayoutStatusBadge';
import { Button } from '@/components/ui/button';
import { formatKes, formatDate, formatRelative } from '@/lib/utils';

interface Props {
  investments: Investment[];
}

export const ManualHoldTable = ({ investments: initial }: Props) => {
  const [investments, setInvestments] = useState(initial);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRetry = (investmentId: string) => {
    setRetryingId(investmentId);
    startTransition(async () => {
      const result = await retryPayoutAction(investmentId);
      if (result.success) {
        toast.success('Payout job re-queued successfully.');
        // Optimistically remove from MANUAL_HOLD list
        setInvestments((prev) => prev.filter((i) => i._id !== investmentId));
      } else {
        toast.error(result.message);
      }
      setRetryingId(null);
    });
  };

  if (investments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-brand-200 bg-brand-50 py-16">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
          <AlertOctagon className="h-6 w-6 text-brand-600" />
        </div>
        <p className="mt-3 font-medium text-brand-800">
          No manual holds — all payouts healthy
        </p>
        <p className="mt-1 text-sm text-brand-600">
          Investments requiring intervention will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Critical count banner */}
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <AlertOctagon className="h-5 w-5 flex-shrink-0 text-red-600" />
        <p className="text-sm font-medium text-red-800">
          {investments.length} investment{investments.length > 1 ? 's' : ''}{' '}
          require manual intervention. All retries from the BullMQ queue have
          been exhausted. Review the error details before re-triggering.
        </p>
      </div>

      {/* Investment cards — card layout rather than table for density of error info */}
      <div className="space-y-3">
        {investments.map((inv) => (
          <div
            key={inv._id}
            className="overflow-hidden rounded-lg border border-red-200 bg-white shadow-sm"
          >
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <PayoutStatusBadge status={inv.payoutStatus} />
                <span className="font-mono text-xs text-slate-500">
                  {inv._id}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-700">
                  {formatKes(inv.expectedPayoutKes)}
                </span>
                <span>·</span>
                <span>{inv.payoutAttempts} attempts</span>
              </div>
            </div>

            {/* Card body */}
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
              {/* Error details */}
              <div className="md:col-span-2 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Last Error from Daraja B2C
                </p>
                <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2">
                  <p className="font-mono text-sm text-red-800">
                    {inv.lastPayoutError ?? 'No error message recorded.'}
                  </p>
                </div>
                {inv.deadLetterAt && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Calendar className="h-3.5 w-3.5" />
                    Moved to dead-letter{' '}
                    {formatRelative(inv.deadLetterAt)}
                    {' '}({formatDate(inv.deadLetterAt)})
                  </div>
                )}
              </div>

              {/* Actions + meta */}
              <div className="flex flex-col justify-between gap-3">
                <div className="space-y-1.5 rounded-md bg-slate-50 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Phone className="h-3.5 w-3.5" />
                    <span>
                      {typeof inv.investorId === 'string'
                        ? inv.investorId
                        : 'Investor ID on file'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Type:{' '}
                    <span className="font-medium capitalize">
                      {inv.investorType.toLowerCase()}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Principal:{' '}
                    <span className="font-medium">
                      {formatKes(inv.amountInvestedKes)}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Profit:{' '}
                    <span className="font-medium text-brand-600">
                      {inv.expectedReturnPercent}% ={' '}
                      {formatKes(
                        inv.expectedPayoutKes - inv.amountInvestedKes
                      )}
                    </span>
                  </p>
                </div>

                <Button
                  onClick={() => handleRetry(inv._id)}
                  loading={isPending && retryingId === inv._id}
                  disabled={isPending}
                  variant="destructive"
                  className="w-full gap-2"
                  size="sm"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Manual Retry
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};