import { cn } from '@/lib/utils';
import { CampaignStatus } from '@/types/api.types';

const STATUS_CONFIG: Record<CampaignStatus, { label: string; className: string }> = {
  DRAFT:                  { label: 'Draft',               className: 'bg-slate-100 text-slate-600' },
  FUNDING:                { label: 'Funding',              className: 'bg-blue-100 text-blue-700' },
  AWAITING_PLATFORM_FILL: { label: 'Needs Injection',      className: 'bg-amber-100 text-amber-700 animate-pulse-amber' },
  FULLY_FUNDED:           { label: 'Fully Funded',         className: 'bg-brand-100 text-brand-700' },
  LOCKED_IN_TRANSIT:      { label: 'In Transit',           className: 'bg-purple-100 text-purple-700' },
  AWAITING_SETTLEMENT:    { label: 'Awaiting Settlement',  className: 'bg-orange-100 text-orange-700' },
  COMPLETED:              { label: 'Completed',            className: 'bg-brand-100 text-brand-800' },
  CANCELLED:              { label: 'Cancelled',            className: 'bg-red-100 text-red-700' },
};

export const CampaignStatusBadge = ({ status }: { status: CampaignStatus }) => {
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