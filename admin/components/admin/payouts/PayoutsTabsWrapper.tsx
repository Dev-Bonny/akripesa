'use client';

import { useState } from 'react';
import { CampaignPayoutSummary } from '@/actions/payout.actions';
import { Investment } from '@/types/api.types';
import { PayoutQueueTable } from './PayoutQueueTable';
import { ManualHoldTable } from './ManualHoldTable';
import { cn } from '@/lib/utils';

interface Props {
  summaries: CampaignPayoutSummary[];
  manualHolds: Investment[];
  holdCount: number;
}

export const PayoutsTabsWrapper = ({
  summaries,
  manualHolds,
  holdCount,
}: Props) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'dlq'>(
    holdCount > 0 ? 'dlq' : 'queue' // Default to DLQ tab if there are holds
  );

  const tabs = [
    { id: 'queue' as const, label: 'Active Queues',  count: summaries.length, countColor: 'bg-blue-100 text-blue-700' },
    { id: 'dlq'   as const, label: 'Manual Hold',    count: holdCount,        countColor: holdCount > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-500' },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {tab.label}
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', tab.countColor)}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === 'queue' && <PayoutQueueTable summaries={summaries} />}
      {activeTab === 'dlq'   && <ManualHoldTable investments={manualHolds} />}
    </div>
  );
};