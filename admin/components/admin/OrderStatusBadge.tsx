import { cn } from '@/lib/utils';
import { OrderStatus } from '@/types/api.types';

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  ESCROW_LOCKED:      { label: 'Escrow Locked',      className: 'bg-slate-100 text-slate-600' },
  AWAITING_DISPATCH:  { label: 'Awaiting Dispatch',  className: 'bg-blue-100 text-blue-600' },
  DRIVER_ASSIGNED:    { label: 'Driver Assigned',    className: 'bg-purple-100 text-purple-700' },
  VENDOR_PREPPING:    { label: 'Vendor Prepping',    className: 'bg-amber-100 text-amber-700' },
  IN_TRANSIT:         { label: 'In Transit',         className: 'bg-brand-100 text-brand-700' },
  DELIVERED:          { label: 'Delivered',          className: 'bg-brand-200 text-brand-800' },
  AWAITING_DRIVER:    { label: 'No Driver Found',    className: 'bg-red-200 text-red-800 font-semibold' },
  DISPUTED:           { label: 'Disputed',           className: 'bg-red-100 text-red-700' },
  CANCELLED:          { label: 'Cancelled',          className: 'bg-slate-200 text-slate-600' },
  SETTLED:            { label: 'Settled',            className: 'bg-brand-100 text-brand-800' },
};

export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: 'bg-slate-100 text-slate-600',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  );
};