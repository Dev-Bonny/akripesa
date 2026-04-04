'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Truck,
  CreditCard,
  AlertTriangle,
  LogOut,
  Leaf,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Campaigns',
    href: '/admin/campaigns',
    icon: FileText,
    badge: 'Underwriting Hub',
  },
  {
    label: 'Payouts',
    href: '/admin/payouts',
    icon: CreditCard,
    badge: 'DLQ Monitor',
  },
  {
    label: 'Logistics',
    href: '/admin/logistics',
    icon: Truck,
    badge: 'Command Center',
  },
] as const;

export const Sidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
          <Leaf className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Akripesa</p>
          <p className="text-xs text-slate-400">Super Admin</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <item.icon
                className={cn(
                  'h-4 w-4 flex-shrink-0',
                  isActive ? 'text-brand-600' : 'text-slate-400'
                )}
              />
              <span className="flex-1">{item.label}</span>
              {'badge' in item && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-slate-100 p-4">
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600">
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};