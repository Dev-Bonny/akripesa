import { Metadata } from 'next';
import { Wallet, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { fetchMyPortfolio } from '@/actions/investment.actions';
import {
  InvestmentStatusBadge,
  PayoutStatusBadge,
} from '@/components/investor/InvestmentStatusBadge';
import { PortfolioSummaryCard } from '@/components/investor/PortfolioSummaryCard';
import { formatKes, formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'My Portfolio' };
export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
  const investments = await fetchMyPortfolio();

  const totalInvested = investments.reduce((s, i) => s + i.amountInvestedKes, 0);
  const totalEarned   = investments
    .filter((i) => i.status === 'PAID_OUT')
    .reduce((s, i) => s + (i.actualProfitKes ?? 0), 0);
  const activeCount   = investments.filter(
    (i) => ['CONFIRMED', 'LOCKED'].includes(i.status)
  ).length;
  const paidOutCount  = investments.filter((i) => i.status === 'PAID_OUT').length;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Portfolio</h1>
        <p className="text-sm text-muted-foreground">
          Full history of your investments and payouts.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <PortfolioSummaryCard
          label="Total Invested"
          value={formatKes(totalInvested)}
          icon={Wallet}
          accent="brand"
        />
        <PortfolioSummaryCard
          label="Total Earned"
          value={formatKes(totalEarned)}
          subValue="Net profit received"
          icon={TrendingUp}
          accent={totalEarned > 0 ? 'growth' : 'neutral'}
        />
        <PortfolioSummaryCard
          label="Active"
          value={activeCount.toString()}
          subValue="Positions earning"
          icon={Clock}
          accent="brand"
        />
        <PortfolioSummaryCard
          label="Completed"
          value={paidOutCount.toString()}
          subValue="Paid out to M-Pesa"
          icon={CheckCircle2}
          accent={paidOutCount > 0 ? 'growth' : 'neutral'}
        />
      </div>

      {/* Investments table */}
      {investments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <p className="font-medium text-slate-700">No investments yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Head to the Marketplace to make your first investment.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          {/* Table header */}
          <div className="hidden grid-cols-6 bg-muted px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
            <div className="col-span-2">Campaign</div>
            <div>Invested</div>
            <div>Expected Payout</div>
            <div>Status</div>
            <div>Payout</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {investments.map((inv) => {
              const campaign =
                typeof inv.campaignId === 'object' ? inv.campaignId : null;

              return (
                <div
                  key={inv._id}
                  className="grid grid-cols-1 gap-2 px-4 py-4 sm:grid-cols-6 sm:items-center sm:gap-0"
                >
                  {/* Campaign info */}
                  <div className="sm:col-span-2">
                    <p className="font-medium text-slate-900">
                      {campaign
                        ? `${campaign.commodity.charAt(0) + campaign.commodity.slice(1).toLowerCase()}`
                        : 'Investment'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {campaign?.publicData.category ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(inv.pledgedAt)}
                    </p>
                  </div>

                  {/* Amount */}
                  <div>
                    <p className="text-sm font-semibold">
                      {formatKes(inv.amountInvestedKes)}
                    </p>
                    <p className="text-xs text-growth-600">
                      +{inv.expectedReturnPercent}% ROI
                    </p>
                  </div>

                  {/* Expected payout */}
                  <div>
                    <p className="text-sm font-semibold">
                      {formatKes(inv.expectedPayoutKes)}
                    </p>
                    {inv.actualPayoutKes && (
                      <p className="text-xs text-growth-600">
                        Actual: {formatKes(inv.actualPayoutKes)}
                      </p>
                    )}
                  </div>

                  {/* Investment status */}
                  <div>
                    <InvestmentStatusBadge status={inv.status} />
                    {inv.mpesaReceiptNumber && (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {inv.mpesaReceiptNumber}
                      </p>
                    )}
                  </div>

                  {/* Payout status */}
                  <div>
                    <PayoutStatusBadge status={inv.payoutStatus} />
                    {inv.payoutMpesaReceiptNumber && (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {inv.payoutMpesaReceiptNumber}
                      </p>
                    )}
                    {inv.paidOutAt && (
                      <p className="text-xs text-muted-foreground">
                        {formatDate(inv.paidOutAt)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}