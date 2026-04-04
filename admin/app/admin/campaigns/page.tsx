import { Metadata } from 'next';
import { FileText, PlusCircle, TrendingUp, Clock, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { fetchAdminCampaignsTable } from '@/actions/campaign.actions';
import { CampaignsTable } from '@/components/admin/underwriting/CampaignsTable';
import { KpiCard } from '@/components/admin/KpiCard';
import { Button } from '@/components/ui/button';
import { formatKes } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Underwriting Hub',
};

// Force dynamic — campaign funding states change in real time
export const dynamic = 'force-dynamic';

export default async function UnderwritingHubPage() {
  const campaigns = await fetchAdminCampaignsTable();

  // Server-side KPI aggregation
  const activeCampaigns    = campaigns.filter((c) => c.status === 'FUNDING').length;
  const urgentCampaigns    = campaigns.filter((c) => c.isUrgent).length;
  const totalFundedKes     = campaigns.reduce((s, c) => s + c.currentFundedAmountKes, 0);
  const totalInjectedKes   = campaigns.reduce(
    (s, c) => s + (c.platformInjection?.injectedAmountKes ?? 0),
    0
  );

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Underwriting Hub</h1>
          <p className="text-sm text-slate-500">
            Monitor all LPO campaigns and trigger platform capital injections.
          </p>
        </div>
        <Link href="/admin/campaigns/new">
          <Button className="gap-2">
            <PlusCircle className="h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Active Campaigns"
          value={activeCampaigns}
          subtitle="Currently funding"
          icon={FileText}
          variant="default"
        />
        <KpiCard
          title="Urgent Reviews"
          value={urgentCampaigns}
          subtitle="Deadline within 48h, underfunded"
          icon={Clock}
          variant={urgentCampaigns > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          title="Total Funded"
          value={formatKes(totalFundedKes)}
          subtitle="Across all active campaigns"
          icon={TrendingUp}
          variant="success"
        />
        <KpiCard
          title="Platform Injections"
          value={formatKes(totalInjectedKes)}
          subtitle="Credit line deployed"
          icon={DollarSign}
          variant={totalInjectedKes > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Campaigns Table — Client Component for sorting/filtering */}
      <CampaignsTable initialData={campaigns} />
    </div>
  );
}