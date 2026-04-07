import Link from 'next/link';
import { ShieldCheck, TrendingUp, Smartphone, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchFundingCampaigns } from '@/actions/campaign.actions';

export const dynamic = 'force-dynamic';

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Browse Verified LPOs',
    body: 'We sign supply contracts with hospitals, schools, and institutions. You see an anonymized tranche — the real buyer is never disclosed.',
    icon: ShieldCheck,
  },
  {
    step: '02',
    title: 'Invest via M-Pesa',
    body: 'Choose an amount from KES 100. Confirm on your phone in seconds. Your funds go into escrow — never directly to us.',
    icon: Smartphone,
  },
  {
    step: '03',
    title: 'Earn Your Return',
    body: 'Once the produce is delivered and the institution pays, your principal plus profit is sent directly to your M-Pesa.',
    icon: TrendingUp,
  },
];

export default async function LandingPage() {
  const campaigns = await fetchFundingCampaigns();
  const activeCampaigns = campaigns.length;
  const avgReturn = campaigns.length > 0
    ? (campaigns.reduce((s, c) => s + c.expectedReturnPercent, 0) / campaigns.length).toFixed(1)
    : '5.0';

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
              <Leaf className="h-4 w-4 text-brand-950" />
            </div>
            <span className="font-bold text-slate-900">Akripesa</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-50 to-white px-4 py-20 text-center">
        <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-100 px-4 py-1.5 text-sm font-medium text-brand-700">
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse-green" />
            {activeCampaigns} active campaigns live
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Earn up to{' '}
            <span className="text-brand-600">{avgReturn}%</span>
            {' '}returns
            <br className="hidden sm:block" />
            funding Kenya&apos;s food supply chain.
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Akripesa connects everyday investors to verified institutional
            purchase orders. Invest from KES 100 via M-Pesa. No bank account
            required.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto">
                Start Investing — Free
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Browse Campaigns
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-muted/40 py-12">
        <div className="mx-auto grid max-w-5xl grid-cols-3 gap-8 px-4 text-center">
          {[
            { label: 'Active Campaigns', value: activeCampaigns.toString() },
            { label: 'Average Return',   value: `${avgReturn}%` },
            { label: 'Min. Investment',  value: 'KES 100' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-extrabold text-brand-600">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-slate-900">
            How it works
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="relative space-y-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100">
                  <item.icon className="h-7 w-7 text-brand-600" />
                </div>
                <span className="absolute -top-2 right-[calc(50%-44px)] text-6xl font-black text-brand-100 select-none">
                  {item.step}
                </span>
                <h3 className="font-bold text-slate-900">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-500 px-4 py-16 text-center">
        <div className="mx-auto max-w-xl space-y-4">
          <h2 className="text-3xl font-bold text-brand-950">
            Ready to grow your money?
          </h2>
          <p className="text-brand-800">
            Join thousands of Kenyans earning returns on every harvest cycle.
          </p>
          <Link href="/register">
            <Button
              size="lg"
              className="mt-2 bg-white text-brand-700 hover:bg-brand-50"
            >
              Create Free Account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Akripesa Ltd. All rights reserved.</p>
        <p className="mt-1">
          Investments carry risk. Past returns do not guarantee future results.
        </p>
      </footer>
    </div>
  );
}