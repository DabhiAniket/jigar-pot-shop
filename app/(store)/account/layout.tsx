import type { Metadata } from 'next';

// Personal pages: never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <div className="container-page max-w-5xl pt-10 pb-12 md:pt-16">{children}</div>;
}
