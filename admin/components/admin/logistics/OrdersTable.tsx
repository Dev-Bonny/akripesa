'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, RefreshCw, MapPin, Package, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { EnrichedOrder } from '@/actions/logistics.actions';
import { rerouteOrderAction } from '@/actions/logistics.actions';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { Button } from '@/components/ui/button';
import { formatKes, formatRelative } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Props {
  orders: EnrichedOrder[];
  selectedOrderId: string | null;
  onSelectOrder: (orderId: string) => void;
}

export const OrdersTable = ({
  orders,
  selectedOrderId,
  onSelectOrder,
}: Props) => {
  const [reroutingId, setReroutingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleReroute = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger row selection
    setReroutingId(orderId);
    startTransition(async () => {
      const result = await rerouteOrderAction(orderId);
      if (result.success) {
        toast.success('Order re-queued for dispatch.');
      } else {
        toast.error(result.message);
      }
      setReroutingId(null);
    });
  };

  const awaitingDriverCount = orders.filter((o) => o.isAwaitingDriver).length;

  return (
    <div className="flex h-full flex-col">
      {/* Panel header */}
      <div className="flex-shrink-0 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Active Orders
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {orders.length}
            </span>
          </h2>
          {awaitingDriverCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {awaitingDriverCount} need re-routing
            </span>
          )}
        </div>
      </div>

      {/* Order list */}
      <div className="flex-1 divide-y divide-slate-50 overflow-y-auto">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Truck className="h-10 w-10 mb-3" />
            <p className="text-sm">No active orders.</p>
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order._id}
              onClick={() => onSelectOrder(order._id)}
              className={cn(
                'cursor-pointer px-4 py-3 transition-colors',
                order.isAwaitingDriver
                  ? 'bg-red-50/70 hover:bg-red-50'
                  : 'hover:bg-slate-50',
                selectedOrderId === order._id && 'ring-1 ring-inset ring-brand-400 bg-brand-50/30'
              )}
            >
              {/* Order header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {order.isAwaitingDriver && (
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {order.commodity.charAt(0) +
                        order.commodity.slice(1).toLowerCase()}{' '}
                      — {order.quantityKg.toLocaleString()}kg
                    </p>
                    <p className="font-mono text-xs text-slate-400">
                      #{order._id.slice(-8).toUpperCase()}
                    </p>
                  </div>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>

              {/* Route summary */}
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="h-3 w-3 flex-shrink-0 text-slate-400" />
                <span className="truncate">{order.pickupLocation.address}</span>
                <span className="text-slate-300">→</span>
                <span className="truncate">{order.deliveryLocation.address}</span>
              </div>

              {/* Meta row */}
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {order.distanceKm.toFixed(1)}km
                  </span>
                  <span>{formatKes(order.transportFeeKes)}</span>
                  {order.dispatchAttemptCount > 0 && (
                    <span className="text-amber-600">
                      {order.dispatchAttemptCount} dispatch
                      {order.dispatchAttemptCount > 1 ? ' attempts' : ''}
                    </span>
                  )}
                  {order.vehicleClassUsed && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium">
                      {order.vehicleClassUsed}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  {formatRelative(order.createdAt)}
                </span>
              </div>

              {/* Re-route action — only for AWAITING_DRIVER */}
              {order.isAwaitingDriver && (
                <div className="mt-2.5">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full gap-1.5 text-xs"
                    onClick={(e) => handleReroute(order._id, e)}
                    loading={isPending && reroutingId === order._id}
                    disabled={isPending}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Re-route Order
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};