import { Toaster } from 'sonner';
import { requireInvestorSession } from '@/lib/auth';
import { InvestorNav } from '@/components/layout/InvestorNav';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  // Server-side auth guard — redirects to /login if no valid session
  const user = requireInvestorSession();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <InvestorNav user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 md:pb-8">
        {children}
      </main>
      <MobileBottomNav />
      <Toaster position="top-center" richColors />
    </div>
  );
}