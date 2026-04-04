import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default:  'Akripesa Admin',
    template: '%s — Akripesa Admin',
  },
  description: 'Akripesa Super Admin Dashboard',
  robots: {
    index:  false, // Admin dashboard must never be indexed
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}