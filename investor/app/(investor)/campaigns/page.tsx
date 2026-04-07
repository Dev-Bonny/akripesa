import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ShieldCheck, Package, Clock,
  TrendingUp, MapPin, Users,
} from 'lucide-react';
import { fetchCampaignById } from '@/actions/campaign.actions';
import { FundingProgressBar } from '@/components/investor/FundingProgressBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatKes, hoursUntil, toTitleCase, formatDate } from '@/lib/utils';

interface Props { params: { campaignId: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const campaign = await fetchCampaignById(params.campaignId);
  if (!campaign) return { title: 'Campaign Not Found' };
  return { title: `${toTitleCase(campaign.commodity)} — ${campaign.publicData.category}` };
}

export const dynamic = 'force-dynamic';

export default async function CampaignDetailPage({ params }: Props) {
  const campaign = await fetchCampaignById(params.campaignId);
  if (!campaign) notFound();

  const hours       = hoursUntil(campaign.deadline);
  const isClosed    = hours === 0;
  const profitOnMin = Math.floor((10000 * campaign.expectedReturnPercent) / 100);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back */}
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Marketplace
      </Link>

      {/* Hero card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-brand-50 to-white">
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {toTitleCase(campaign.commodity)} Supply Contract
              </h1>
              <p className="text-muted-foreground">{campaign.publicData.category}</p>
            </div>
            {campaign.publicData.verifiedByPlatform && (
              <span className="flex items-center gap-1.5 rounded-full border border-growth-200 bg-growth-50 px-3 py-1.5 text-sm font-medium text-growth-700">
                <ShieldCheck className="h-4 w-4" />
                Akripesa Verified
              </span>
            )}
          </div>

          {/* Progress */}
          <FundingProgressBar
            percent={campaign.fundingProgressPercent}
            currentKes={campaign.currentFundedAmountKes}
            targetKes={campaign.targetAmountKes}
            showLabels
            size="lg"
          />

          {/* Key stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: TrendingUp, label: 'Return',   value: `${campaign.expectedReturnPercent}%`,  accent: 'text-growth-600' },
              { icon: Clock,      label: 'Duration',  value: `${campaign.durationDays} days`,       accent: 'text-brand-600' },
              { icon: Package,    label: 'Quantity',  value: `${campaign.quantityKg.toLocaleString()} kg`, accent: 'text-slate-700' },
              { icon: Clock,      label: 'Closes',    value: isClosed ? 'Closed' : `${Math.floor(hours / 24)}d ${hours % 24}h`, accent: isClosed ? 'text-red-500' : 'text-slate-700' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-muted px-4 py-3 text-center">
                <stat.icon className={`mx-auto mb-1 h-4 w-4 ${stat.accent}`} />
                <p className={`text-sm font-bold ${stat.accent}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Details */}
        <div className="space-y-4 lg:col-span-2">
          {/* Buyer profile */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <h2 className="font-semibold text-slate-900">Buyer Profile</h2>
              <div className="flex items-start gap-3 rounded-lg bg-muted p-3">
                <Users className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {campaign.publicData.category}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {campaign.publicData.historySummary}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logistics */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <h2 className="font-semibold text-slate-900">Logistics</h2>
              <div className="space-y-2">
                {[
                  { label: 'From', address: campaign.pickupLocation.address },
                  { label: 'To',   address: campaign.deliveryLocation.address },
                ].map((loc) => (
                  <div key={loc.label} className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500" />
                    <div>
                      <span className="text-xs font-semibold uppercase text-muted-foreground">
                        {loc.label}
                      </span>
                      <p className="text-sm text-slate-700">{loc.address}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Risk notice */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>Risk notice:</strong> Investments carry risk. Returns are
            dependent on successful delivery and buyer payment. Akripesa
            underwrites shortfalls via a bank credit facility.
          </div>
        </div>

        {/* Right: Invest CTA */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardContent className="p-5 space-y-4">
              <h2 className="font-semibold text-slate-900">Invest in this campaign</h2>

              <div className="rounded-lg bg-growth-50 border border-growth-200 p-3 text-center">
                <p className="text-xs text-growth-600">On KES 100 minimum</p>
                <p className="text-2xl font-bold text-growth-700">
                  +{formatKes(profitOnMin)} profit
                </p>
                <p className="text-xs text-growth-600">
                  in {campaign.durationDays} days
                </p>
              </div>

              {isClosed ? (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center text-sm text-red-600">
                  This campaign has closed.
                </div>
              ) : (
                <Link href={`/checkout/${campaign._id}`} className="block">
                  <Button className="w-full" size="lg">
                    Invest Now via M-Pesa
                  </Button>
                </Link>
              )}

              <p className="text-center text-xs text-muted-foreground">
                Minimum KES 100 · Paid via M-Pesa STK Push
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}