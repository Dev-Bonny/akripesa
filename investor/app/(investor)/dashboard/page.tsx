import { Metadata } from 'next';
import Link from 'next/link';
import { TrendingUp, Wallet, ArrowRight, PiggyBank } from 'lucide-react';
import { requireInvestorSession } from '@/lib/auth';
import { fetchMyPortfolio } from '@/actions/investment.actions';
import { fetchFundingCampaigns } from '@/actions/campaign.actions';
import { PortfolioSummaryCard } from '@/components/investor/PortfolioSummaryCard';
import { CampaignCard } from '@/components/investor/CampaignCard';
import { InvestmentStatusBadge } from '@/components/investor/InvestmentStatusBadge';
import { Button } from '@/components/ui/button';
import { formatKes, formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = requireInvestorSession();

  const [investments, campaigns] = await Promise.all([
    fetchMyPortfolio(),
    fetchFundingCampaigns(),
  ]);

  // Aggregate portfolio metrics
  const totalInvested  = investments.reduce((s, i) => s + i.amountInvestedKes, 0);
  const totalReturned  = investments
    .filter((i) => i.status === 'PAID_OUT')
    .reduce((s, i) => s + (i.actualPayoutKes ?? i.expectedPayoutKes), 0);
  const activeCount    = investments.filter(
    (i) => ['CONFIRMED', 'LOCKED'].includes(i.status)
  ).length;

  const recentInvestments = investments.slice(0, 5);
  const featuredCampaigns = campaigns.slice(0, 3);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Good {getTimeOfDay()}, Investor 👋
        </h1>
        <p className="text-sm text-muted-foreground">{user.phoneNumber}</p>
      </div>

      {/* Portfolio KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <PortfolioSummaryCard
          label="Total Invested"
          value={formatKes(totalInvested)}
          subValue="Lifetime contributions"
          icon={Wallet}
          accent="brand"
        />
        <PortfolioSummaryCard
          label="Active Positions"
          value={activeCount.toString()}
          subValue="Currently earning"
          icon={TrendingUp}
          accent="growth"
        />
        <PortfolioSummaryCard
          label="Total Returned"
          value={formatKes(totalReturned)}
          subValue="Received via M-Pesa"
          icon={PiggyBank}
          accent={totalReturned > 0 ? 'growth' : 'neutral'}
        />
      </div>

      {/* Recent investments */}
      {recentInvestments.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Investments</h2>
            <Link
              href="/portfolio"
              className="flex items-center gap-1 text-sm text-brand-600 hover:underline"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {recentInvestments.map((inv, idx) => {
              const campaign = typeof inv.campaignId === 'object' ? inv.campaignId : null;
              return (
                <div
                  key={inv._id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    idx < recentInvestments.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {campaign
                        ? `${campaign.commodity.charAt(0) + campaign.commodity.slice(1).toLowerCase()} — ${campaign.publicData.category}`
                        : 'Investment'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(inv.pledgedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-sm font-semibold">
                        {formatKes(inv.amountInvestedKes)}
                      </p>
                      <p className="text-xs text-growth-600">
                        +{formatKes(inv.expectedPayoutKes - inv.amountInvestedKes)} est.
                      </p>
                    </div>
                    <InvestmentStatusBadge status={inv.status} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Featured campaigns */}
      {featuredCampaigns.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Live Opportunities</h2>
            <Link
              href="/marketplace"
              className="flex items-center gap-1 text-sm text-brand-600 hover:underline"
            >
              See all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {featuredCampaigns.map((c) => (
              <CampaignCard key={c._id} campaign={c} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {investments.length === 0 && (
        <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-6 py-12 text-center">
          <p className="text-lg font-semibold text-brand-800">
            Your portfolio is empty
          </p>
          <p className="mt-1 text-sm text-brand-600">
            Browse active campaigns and make your first investment.
          </p>
          <Link href="/marketplace" className="mt-4 inline-block">
            <Button>Browse Campaigns</Button>
          </Link>
        </div>
      )}
    </div>
  );
}

const getTimeOfDay = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
};