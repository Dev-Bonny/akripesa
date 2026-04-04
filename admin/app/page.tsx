import { redirect } from 'next/navigation';

// Root URL redirects immediately to the admin dashboard
export default function RootPage() {
  redirect('/admin/campaigns');
}