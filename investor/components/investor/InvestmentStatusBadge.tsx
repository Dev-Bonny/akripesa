import { cn } from '@/lib/utils';
import { PayoutStatus, InvestmentStatus } from '@/types/api.types';

const PAYOUT_CONFIG: Record<PayoutStatus, { label: string; className: string }> = {
  PENDING:     { label: 'Pending',      className: 'bg-slate-100 text-slate-500' },
  QUEUED:      { label: 'In Queue',     className: 'bg-blue-100 text-blue-600' },
  PROCESSING:  { label: 'Processing',   className: 'bg-purple-100 text-purple-700' },
  SUCCESS:     { label: '✓ Paid Out',   className: 'bg-growth-100 text-growth-700 font-semibold' },
  FAILED:      { label: 'Failed',       className: 'bg-red-100 text-red-600' },
  MANUAL_HOLD: { label: 'On Hold',      className: 'bg-amber-100 text-amber-700' },
};

const INVESTMENT_CONFIG: Record<InvestmentStatus, { label: string; className: string }> = {
  PLEDGED:   { label: 'Awaiting M-Pesa', className: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { label: 'Confirmed',       className: 'bg-blue-100 text-blue-700' },
  LOCKED:    { label: 'Locked In',       className: 'bg-purple-100 text-purple-700' },
  PAID_OUT:  { label: '✓ Paid Out',      className: 'bg-growth-100 text-growth-700 font-semibold' },
  REFUNDED:  { label: 'Refunded',        className: 'bg-slate-100 text-slate-600' },
  FAILED:    { label: 'Failed',          className: 'bg-red-100 text-red-600' },
};

export const PayoutStatusBadge = ({ status }: { status: PayoutStatus }) => {
  const config = PAYOUT_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs', config.className)}>
      {config.label}
    </span>
  );
};

export const InvestmentStatusBadge = ({ status }: { status: InvestmentStatus }) => {
  const config = INVESTMENT_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs', config.className)}>
      {config.label}
    </span>
  );
};