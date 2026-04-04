import { Metadata } from 'next';
import {
  FileText,
  CreditCard,
  Truck,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Dashboard' };

const QUICK_LINKS = [
  {
    label: 'Underwriting Hub',
    description: 'Create and manage LPO campaigns',
    href: '/admin/campaigns',
    icon: FileText,
    color: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  {
    label: 'Settlement & DLQ',
    description: 'Monitor payout queues and manual holds',
    href: '/admin/payouts',
    icon: CreditCard,
    color: 'bg-amber-50 text-amber-600 border-amber-100',
  },
  {
    label: 'Logistics Command',
    description: 'Track live orders and re-route drivers',
    href: '/admin/logistics',
    icon: Truck,
    color: 'bg-purple-50 text-purple-600 border-purple-100',
  },
] as const;

export default function DashboardPage() {
  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome to Akripesa Admin
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Full KPI dashboard arrives in a later sprint. Use the quick links
          below or the sidebar to navigate.
        </p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-start gap-4 rounded-lg border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className={`rounded-lg border p-2.5 ${link.color}`}>
              <link.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">{link.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {link.description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Sprint notice */}
      <div className="rounded-lg border border-brand-200 bg-brand-50 px-5 py-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-brand-600" />
          <p className="text-sm font-medium text-brand-800">
            Sprint 5 complete — all four admin views are operational.
          </p>
        </div>
        <p className="mt-1 text-xs text-brand-600 ml-6">
          Sprint 6 will add the Retail Investor App. The full KPI overview
          (total AUM, active campaigns, platform margin) will be wired here
          once the investor data layer is in place.
        </p>
      </div>
    </div>
  );
}