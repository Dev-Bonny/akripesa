import { Metadata } from 'next';
import { Truck, AlertTriangle, MapPin, Activity } from 'lucide-react';
import { fetchActiveOrders } from '@/actions/logistics.actions';
import { LogisticsCommandCenter } from '@/components/admin/logistics/LogisticsCommandCenter';
import { KpiCard } from '@/components/admin/KpiCard';

export const metadata: Metadata = { title: 'Logistics Command Center' };
export const dynamic = 'force-dynamic';

export default async function LogisticsPage() {
  const orders = await fetchActiveOrders();

  // Server-side KPI aggregation
  const awaitingDriver = orders.filter((o) => o.isAwaitingDriver).length;
  const inTransit      = orders.filter((o) => o.status === 'IN_TRANSIT').length;
  const assigned       = orders.filter((o) => o.status === 'DRIVER_ASSIGNED').length;
  const totalOrders    = orders.length;

  return (
    <div className="flex h-screen flex-col gap-4 overflow-hidden p-6">
      {/* Header */}
      <div className="flex-shrink-0">
        <h1 className="text-xl font-bold text-slate-900">
          Logistics Command Center
        </h1>
        <p className="text-sm text-slate-500">
          Real-time order tracking. Red markers and rows require immediate
          driver re-routing.
        </p>
      </div>

      {/* KPIs */}
      <div className="flex-shrink-0 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          title="Total Active"
          value={totalOrders}
          subtitle="Orders in system"
          icon={Activity}
          variant="default"
        />
        <KpiCard
          title="In Transit"
          value={inTransit}
          subtitle="OTP 1 confirmed"
          icon={Truck}
          variant="success"
        />
        <KpiCard
          title="Driver Assigned"
          value={assigned}
          subtitle="En route to farm"
          icon={MapPin}
          variant="default"
        />
        <KpiCard
          title="No Driver Found"
          value={awaitingDriver}
          subtitle="Require manual re-route"
          icon={AlertTriangle}
          variant={awaitingDriver > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Command Center — split layout, takes remaining height */}
      <div className="min-h-0 flex-1">
        <LogisticsCommandCenter orders={orders} />
      </div>
    </div>
  );
}