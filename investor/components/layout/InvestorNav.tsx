import Link from 'next/link';
import { Leaf, LogOut } from 'lucide-react';
import { logoutAction } from '@/actions/auth.actions';
import { SessionUser } from '@/lib/auth';

interface Props {
  user: SessionUser;
}

export const InvestorNav = ({ user }: Props) => (
  <header className="sticky top-0 z-50 w-full border-b border-border bg-white/95 backdrop-blur">
    <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
          <Leaf className="h-4 w-4 text-brand-950" />
        </div>
        <span className="font-bold text-slate-900">Akripesa</span>
      </Link>

      {/* Desktop nav */}
      <nav className="hidden items-center gap-6 md:flex">
        {[
          { href: '/dashboard',   label: 'Dashboard' },
          { href: '/marketplace', label: 'Marketplace' },
          { href: '/portfolio',   label: 'Portfolio' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User menu */}
      <div className="flex items-center gap-3">
        <div className="hidden flex-col items-end md:flex">
          <p className="text-sm font-medium text-foreground">
            {user.phoneNumber}
          </p>
          <p className="text-xs text-muted-foreground">Investor</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  </header>
);