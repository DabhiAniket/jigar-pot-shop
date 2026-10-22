import type { Metadata, Viewport } from 'next';
import { Fraunces, Manrope, Noto_Serif_Gujarati } from 'next/font/google';
import { BRAND_NAME, SITE_URL } from '@/lib/config';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['SOFT', 'opsz'],
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const gujarati = Noto_Serif_Gujarati({
  subsets: ['gujarati'],
  variable: '--font-gujarati-serif',
  weight: ['500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND_NAME} — Handcrafted Clay Pots & Earthenware`,
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    'Discover handcrafted clay matkas, earthen water pots, terracotta cookware, planters and decorative pottery from Jigar Matka House.',
  applicationName: BRAND_NAME,
  openGraph: {
    type: 'website',
    siteName: BRAND_NAME,
    locale: 'en_IN',
  },
  twitter: { card: 'summary_large_image' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#f6f0e5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${fraunces.variable} ${manrope.variable} ${gujarati.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
