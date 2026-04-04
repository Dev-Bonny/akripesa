'use client';

import { useState, useTransition, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  Clock,
  Search,
  ExternalLink,
  CheckCircle,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AdminCampaignRow, publishCampaignAction } from '@/actions/campaign.actions';
import { CampaignStatusBadge } from '@/components/admin/CampaignStatusBadge';
import { InjectionConfirmDialog } from './InjectionConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatKes, formatRelative } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Props {
  initialData: AdminCampaignRow[];
}

export const CampaignsTable = ({ initialData }: Props) => {
  const [data, setData] = useState<AdminCampaignRow[]>(initialData);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleRefresh = useCallback(() => {
    // Trigger server revalidation and re-fetch
    window.location.reload();
  }, []);

  const handlePublish = useCallback(
    (campaignId: string) => {
      startTransition(async () => {
        const result = await publishCampaignAction(campaignId);
        if (result.success) {
          toast.success('Campaign published. Now live for funding.');
          setData((prev) =>
            prev.map((c) =>
              c._id === campaignId ? { ...c, status: 'FUNDING' } : c
            )
          );
        } else {
          toast.error(result.message);
        }
      });
    },
    []
  );

  const columns: ColumnDef<AdminCampaignRow>[] = [
    {
      id: 'urgency',
      header: '',
      size: 8,
      cell: ({ row }) =>
        row.original.isUrgent ? (
          <div
            className="h-full w-1.5 rounded-full bg-amber-400"
            title="Urgent: deadline within 48h, underfunded"
          />
        ) : null,
    },
    {
      accessorKey: 'commodity',
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Commodity
          <ArrowUpDown className="h-3 w-3" />
        </button>
      ),
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-slate-900">
            {row.original.commodity.charAt(0) +
              row.original.commodity.slice(1).toLowerCase()}
          </p>
          <p className="text-xs text-slate-400">
            {row.original.quantityKg.toLocaleString()} kg
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'publicData.category',
      header: 'Buyer Category',
      cell: ({ row }) => (
        <span className="text-sm text-slate-600">
          {row.original.publicData.category}
        </span>
      ),
    },
    {
      accessorKey: 'targetAmountKes',
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Target
          <ArrowUpDown className="h-3 w-3" />
        </button>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {formatKes(row.original.targetAmountKes)}
        </span>
      ),
    },
    {
      accessorKey: 'fundingProgressPercent',
      header: 'Funding',
      cell: ({ row }) => {
        const pct = row.original.fundingProgressPercent;
        const isUrgent = row.original.isUrgent;
        return (
          <div className="w-32 space-y-1">
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  'text-xs font-semibold',
                  pct >= 100
                    ? 'text-brand-600'
                    : isUrgent
                    ? 'text-amber-600'
                    : 'text-slate-600'
                )}
              >
                {pct.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-400">
                {formatKes(row.original.currentFundedAmountKes)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  pct >= 100
                    ? 'bg-brand-500'
                    : isUrgent
                    ? 'bg-amber-400'
                    : 'bg-blue-400'
                )}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'deadline',
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Deadline
          <ArrowUpDown className="h-3 w-3" />
        </button>
      ),
      cell: ({ row }) => {
        const hours = row.original.hoursToDeadline;
        const isPast = hours === 0;
        return (
          <div className="flex items-center gap-1.5">
            <Clock
              className={cn(
                'h-3.5 w-3.5',
                isPast
                  ? 'text-red-500'
                  : hours < 48
                  ? 'text-amber-500'
                  : 'text-slate-400'
              )}
            />
            <span
              className={cn(
                'text-sm',
                isPast
                  ? 'font-semibold text-red-600'
                  : hours < 48
                  ? 'font-medium text-amber-700'
                  : 'text-slate-600'
              )}
            >
              {isPast
                ? 'Expired'
                : hours < 24
                ? `${hours}h left`
                : formatRelative(row.original.deadline)}
            </span>
          </div>
        );
      },
      sortingFn: (a, b) =>
        new Date(a.original.deadline).getTime() -
        new Date(b.original.deadline).getTime(),
    },
    {
      accessorKey: 'expectedReturnPercent',
      header: 'ROI',
      cell: ({ row }) => (
        <span className="text-sm font-medium text-brand-700">
          {row.original.expectedReturnPercent}%
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <CampaignStatusBadge status={row.original.status} />
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const campaign = row.original;
        const shortfall =
          campaign.targetAmountKes - campaign.currentFundedAmountKes;

        return (
          <div className="flex items-center gap-2">
            {/* Publish button for DRAFT campaigns */}
            {campaign.status === 'DRAFT' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePublish(campaign._id)}
                disabled={isPending}
                className="gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                Publish
              </Button>
            )}

            {/* Injection button for underfunded campaigns near deadline */}
            {campaign.isUrgent && shortfall > 0 && (
              <InjectionConfirmDialog
                campaignId={campaign._id}
                shortfallKes={shortfall}
                commodityLabel={campaign.commodity}
                onSuccess={handleRefresh}
              />
            )}

            {/* Already injected indicator */}
            {campaign.platformInjection.wasInjected && (
              <span className="flex items-center gap-1 text-xs text-brand-600">
                <CheckCircle className="h-3.5 w-3.5" />
                Injected
              </span>
            )}

            {/* View detail */}
            <Link href={`/admin/campaigns/${campaign._id}`}>
              <Button size="sm" variant="ghost" className="gap-1">
                <ExternalLink className="h-3.5 w-3.5" />
                View
              </Button>
            </Link>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const urgentCount = data.filter((c) => c.isUrgent).length;

  return (
    <div className="space-y-4">
      {/* Urgent alert banner */}
      {urgentCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <Clock className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <p className="text-sm font-medium text-amber-800">
            {urgentCount} campaign{urgentCount > 1 ? 's are' : ' is'} under-funded
            with a deadline within 48 hours. Review and consider injecting
            platform capital.
          </p>
        </div>
      )}

      {/* Search + filter bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search campaigns…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {(['FUNDING', 'AWAITING_PLATFORM_FILL', 'DRAFT', 'COMPLETED'] as const).map(
            (status) => (
              <button
                key={status}
                onClick={() =>
                  setColumnFilters((prev) => {
                    const existing = prev.find((f) => f.id === 'status');
                    if (existing?.value === status) {
                      return prev.filter((f) => f.id !== 'status');
                    }
                    return [
                      ...prev.filter((f) => f.id !== 'status'),
                      { id: 'status', value: status },
                    ];
                  })
                }
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  columnFilters.find((f) => f.id === 'status')?.value === status
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {status === 'AWAITING_PLATFORM_FILL' ? 'Needs Injection' : status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            )
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-50">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-slate-400"
                >
                  No campaigns match the current filter.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'transition-colors hover:bg-slate-50',
                    row.original.isUrgent && 'bg-amber-50/60 hover:bg-amber-50'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        {table.getFilteredRowModel().rows.length} of {data.length} campaigns
      </p>
    </div>
  );
};