import Link from 'next/link';
import { Clock, Package, ShieldCheck, TrendingUp } from 'lucide-react';
import { LPOCampaign } from '@/types/api.types';
import { FundingProgressBar } from './FundingProgressBar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatKes, hoursUntil, toTitleCase } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Props {
  campaign: LPOCampaign;
}

const COMMODITY_EMOJI: Record<string, string> = {
  MAIZE: '🌽', POTATOES: '🥔', BEANS: '🫘', TOMATOES: '🍅',
  ONIONS: '🧅', CABBAGES: '🥬', KALES: '🥦', RICE: '🌾',
  WHEAT: '🌾', SORGHUM: '🌾',
};

export const CampaignCard = ({ campaign }: Props) => {
  const hours    = hoursUntil(campaign.deadline);
  const isUrgent = hours < 48 && campaign.fundingProgressPercent < 100;
  const emoji    = COMMODITY_EMOJI[campaign.commodity] ?? '🌿';

  return (
    <Card className={cn(
      'flex flex-col overflow-hidden transition-shadow hover:shadow-md',
      isUrgent && 'ring-1 ring-amber-300'
    )}>
      {/* Commodity header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-brand-50 to-brand-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{emoji}</span>
          <div>
            <p className="font-bold text-slate-900">
              {toTitleCase(campaign.commodity)}
            </p>
            <p className="text-xs text-slate-500">
              {campaign.quantityKg.toLocaleString()} kg
            </p>
          </div>
        </div>
        {campaign.publicData.verifiedByPlatform && (
          <span className="flex items-center gap-1 rounded-full bg-growth-100 px-2.5 py-1 text-xs font-medium text-growth-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified
          </span>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col gap-4 pt-4">
        {/* Buyer category */}
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
          <Package className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <p className="text-sm text-slate-700">{campaign.publicData.category}</p>
        </div>

        {/* ROI + Duration */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-growth-200 bg-growth-50 p-3 text-center">
            <p className="text-xs text-growth-600">Returns</p>
            <p className="text-xl font-bold text-growth-700">
              {campaign.expectedReturnPercent}%
            </p>
          </div>
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-center">
            <p className="text-xs text-brand-600">Duration</p>
            <p className="text-xl font-bold text-brand-700">
              {campaign.durationDays}d
            </p>
          </div>
        </div>

        {/* Funding progress */}
        <FundingProgressBar
          percent={campaign.fundingProgressPercent}
          currentKes={campaign.currentFundedAmountKes}
          targetKes={campaign.targetAmountKes}
          showLabels
          size="md"
        />

        {/* Deadline */}
        <div className={cn(
          'flex items-center gap-1.5 text-xs',
          isUrgent ? 'text-amber-600 font-medium' : 'text-muted-foreground'
        )}>
          <Clock className="h-3.5 w-3.5" />
          {hours === 0
            ? 'Funding closed'
            : hours < 24
            ? `${hours}h remaining — closing soon`
            : `${Math.floor(hours / 24)} days remaining`}
        </div>

        {/* Target amount */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <div>
            <p className="text-xs text-muted-foreground">Campaign target</p>
            <p className="font-semibold">{formatKes(campaign.targetAmountKes)}</p>
          </div>
          <Link href={`/campaigns/${campaign._id}`}>
            <Button size="sm" variant="secondary">
              Invest Now
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};