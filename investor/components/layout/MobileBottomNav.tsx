'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Store, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard',   label: 'Home',        icon: LayoutDashboard },
  { href: '/marketplace', label: 'Invest',       icon: Store },
  { href: '/portfolio',   label: 'Portfolio',    icon: Briefcase },
] as const;

export const MobileBottomNav = () => {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white md:hidden">
      <div className="grid grid-cols-3">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
                isActive
                  ? 'text-brand-600'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'text-brand-500')} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};