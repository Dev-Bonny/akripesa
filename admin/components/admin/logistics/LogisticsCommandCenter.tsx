'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { EnrichedOrder } from '@/actions/logistics.actions';
import { OrdersTable } from './OrdersTable';

// Dynamic import prevents Leaflet SSR crash
const LogisticsMap = dynamic(
  () => import('./LogisticsMap').then((mod) => mod.LogisticsMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center text-sm text-slate-400">
          <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500" />
          Loading map…
        </div>
      </div>
    ),
  }
);

interface Props {
  orders: EnrichedOrder[];
}

export const LogisticsCommandCenter = ({ orders }: Props) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    // Auto-select first AWAITING_DRIVER order if any exist
    orders.find((o) => o.isAwaitingDriver)?._id ?? null
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Left panel: Orders table — fixed width, scrollable */}
      <div className="flex w-96 flex-shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <OrdersTable
          orders={orders}
          selectedOrderId={selectedOrderId}
          onSelectOrder={setSelectedOrderId}
        />
      </div>

      {/* Right panel: Leaflet map — fills remaining space */}
      <div className="flex-1 overflow-hidden rounded-lg border border-slate-200 shadow-sm">
        <LogisticsMap
          orders={orders}
          selectedOrderId={selectedOrderId}
        />
      </div>
    </div>
  );
};