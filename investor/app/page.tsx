import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

export default function RootPage() {
  const user = getSessionUser();
  // Authenticated investors go straight to dashboard
  if (user) redirect('/dashboard');
  // Everyone else sees the public landing page
  redirect('/home');
}