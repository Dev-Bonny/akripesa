import { cn } from '@/lib/utils';
import { CampaignStatus } from '@/types/api.types';

const STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; className: string }
> = {
  DRAFT:      { label: 'Draft',      className: 'bg-slate-100 text-slate-600' },
  FUNDING:    { label: 'Funding',    className: 'bg-blue-100 text-blue-700' },
  FULLY_FUNDED: { label: 'Funded',   className: 'bg-green-100 text-green-700' },
  IN_TRANSIT: { label: 'In Transit', className: 'bg-amber-100 text-amber-700' },
  SETTLED:    { label: 'Settled',    className: 'bg-slate-800 text-white' },
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