import { Metadata } from 'next';
import { Suspense } from 'react';
import {
  CreditCard,
  AlertOctagon,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import {
  fetchPayoutSummaries,
  fetchManualHoldInvestments,
} from '@/actions/payout.actions';
import { PayoutQueueTable } from '@/components/admin/payouts/PayoutQueueTable';
import { ManualHoldTable } from '@/components/admin/payouts/ManualHoldTable';
import { KpiCard } from '@/components/admin/KpiCard';
import { formatKes } from '@/lib/utils';

export const metadata: Metadata = { title: 'Settlement & DLQ Monitor' };
export const dynamic = 'force-dynamic';

export default async function PayoutsPage() {
  const [summaries, manualHolds] = await Promise.all([
    fetchPayoutSummaries(),
    fetchManualHoldInvestments(),
  ]);

  // Server-side KPI aggregation across all summaries
  const allInvestments = summaries.flatMap((s) => s.investments);
  const totalPaidKes = allInvestments
    .filter((i) => i.payoutStatus === 'SUCCESS')
    .reduce((s, i) => s + (i.actualPayoutKes ?? i.expectedPayoutKes), 0);
  const successCount  = allInvestments.filter((i) => i.payoutStatus === 'SUCCESS').length;
  const pendingCount  = allInvestments.filter(
    (i) => ['QUEUED', 'PROCESSING', 'PENDING'].includes(i.payoutStatus)
  ).length;
  const holdCount     = manualHolds.length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          Settlement & DLQ Monitor
        </h1>
        <p className="text-sm text-slate-500">
          Track Safaricom B2C payout queue and manually re-trigger exhausted
          jobs.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Total Disbursed"
          value={formatKes(totalPaidKes)}
          subtitle="Via M-Pesa B2C"
          icon={CreditCard}
          variant="success"
        />
        <KpiCard
          title="Paid Out"
          value={successCount}
          subtitle="Investor payouts confirmed"
          icon={CheckCircle2}
          variant="success"
        />
        <KpiCard
          title="In Queue"
          value={pendingCount}
          subtitle="Queued or processing"
          icon={Clock}
          variant="default"
        />
        <KpiCard
          title="Manual Hold"
          value={holdCount}
          subtitle="All retries exhausted"
          icon={AlertOctagon}
          variant={holdCount > 0 ? 'danger' : 'default'}
        />
      </div>

      {/*
       * Tabbed layout — implemented with plain HTML radio buttons
       * to avoid any client-side JS for the tab switch itself.
       * ManualHoldTable and PayoutQueueTable are Client Components
       * for their internal interactivity.
       */}
      <div className="space-y-4">
        {/* Tab navigation */}
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 w-fit">
          {[
            {
              id: 'queue',
              label: 'Active Queues',
              count: summaries.length,
              countColor: 'bg-blue-100 text-blue-700',
            },
            {
              id: 'dlq',
              label: 'Manual Hold',
              count: holdCount,
              countColor:
                holdCount > 0
                  ? 'bg-red-100 text-red-700'
                  : 'bg-slate-200 text-slate-500',
            },
          ].map((tab) => (
            // These tabs are rendered as anchor-based client state
            // in the TabsWrapper client component below
            <div key={tab.id} className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium bg-white shadow-sm text-slate-900">
              {tab.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${tab.countColor}`}
              >
                {tab.count}
              </span>
            </div>
          ))}
        </div>

        {/* Tab content — both rendered, CSS visibility toggled by TabsWrapper */}
        <PayoutsTabsWrapper
          summaries={summaries}
          manualHolds={manualHolds}
          holdCount={holdCount}
        />
      </div>
    </div>
  );
}

// ─── Client-side Tab Wrapper (minimal JS) ─────────────────────────────────────

import { PayoutsTabsWrapper } from '@/components/admin/payouts/PayoutsTabsWrapper';