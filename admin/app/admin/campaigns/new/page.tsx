import { Metadata } from 'next';
import { CampaignDeskForm } from '@/components/forms/campaign/CampaignDeskForm';

export const metadata: Metadata = {
  title: 'Campaign Desk — Akripesa Admin',
  description: 'Create a new LPO crowdfunding campaign',
};

/**
 * Server Component page shell.
 * The CampaignDeskForm itself is a Client Component (needs React Hook Form).
 * No data fetching needed here — this is a pure creation form.
 */
export default function CampaignDeskPage() {
  return <CampaignDeskForm />;
}