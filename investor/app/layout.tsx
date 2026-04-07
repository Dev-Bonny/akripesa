import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Akripesa — Invest in Real Agriculture', template: '%s — Akripesa' },
  description: 'Earn returns by funding verified agricultural supply chain contracts.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}