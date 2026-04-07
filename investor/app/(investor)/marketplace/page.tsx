import { Metadata } from 'next';
import { SlidersHorizontal } from 'lucide-react';
import { fetchFundingCampaigns } from '@/actions/campaign.actions';
import { CampaignCard } from '@/components/investor/CampaignCard';

export const metadata: Metadata = { title: 'Marketplace' };
export const dynamic = 'force-dynamic';

const COMMODITIES = ['All', 'MAIZE', 'POTATOES', 'BEANS', 'TOMATOES', 'ONIONS', 'CABBAGES', 'KALES', 'RICE', 'WHEAT'];

interface Props {
  searchParams: { commodity?: string };
}

export default async function MarketplacePage({ searchParams }: Props) {
  const selected = searchParams.commodity?.toUpperCase();
  
  const campaigns = await fetchFundingCampaigns(
    selected && selected !== 'ALL' ? selected : undefined
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Marketplace</h1>
        <p className="text-sm text-muted-foreground">
          Browse live LPO campaigns. All buyers are verified institutional clients.
        </p>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <SlidersHorizontal className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        {COMMODITIES.map((c) => {
          const href = c === 'All' ? '/marketplace' : `/marketplace?commodity=${c}`;
          
          // FIX: Added the missing isActive calculation!
          const isActive = (selected && selected !== 'ALL') 
            ? c.toUpperCase() === selected 
            : c === 'All';

          const cls = isActive
            ? 'flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium bg-brand-500 text-brand-950'
            : 'flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium bg-muted text-muted-foreground hover:bg-accent';
            
          return (
            <a key={c} href={href} className={cls}>
              {c === 'All' ? 'All' : c.charAt(0) + c.slice(1).toLowerCase()}
            </a>
          );
        })}
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
          <p className="font-semibold text-slate-700">No active campaigns</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {selected && selected !== 'ALL'
              ? `No ${selected.toLowerCase()} campaigns are live. Try another commodity.`
              : 'Check back soon — new campaigns are published regularly.'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {campaigns.length} active campaign{campaigns.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <CampaignCard key={c._id} campaign={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}