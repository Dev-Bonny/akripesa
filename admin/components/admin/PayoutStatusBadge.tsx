import { cn } from '@/lib/utils';
import { PayoutStatus } from '@/types/api.types';

const STATUS_CONFIG: Record<PayoutStatus, { label: string; className: string }> = {
  PENDING:     { label: 'Pending',      className: 'bg-slate-100 text-slate-500' },
  QUEUED:      { label: 'Queued',       className: 'bg-blue-100 text-blue-600' },
  PROCESSING:  { label: 'Processing',   className: 'bg-purple-100 text-purple-700' },
  SUCCESS:     { label: 'Paid Out',     className: 'bg-brand-100 text-brand-700' },
  FAILED:      { label: 'Failed',       className: 'bg-red-100 text-red-600' },
  MANUAL_HOLD: { label: 'Manual Hold',  className: 'bg-red-200 text-red-800 font-semibold' },
};

export const PayoutStatusBadge = ({ status }: { status: PayoutStatus }) => {
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