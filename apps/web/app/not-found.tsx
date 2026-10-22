import Link from 'next/link';
import { buttonClasses } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main
      id="main"
      className="grain relative flex min-h-dvh items-center justify-center px-4 py-20 text-center"
    >
      <div className="max-w-lg">
        {/* eslint-disable-next-line @next/next/no-img-element -- brand asset */}
        <img
          src="/brand/v1/emblem-256.webp"
          width={256}
          height={256}
          alt=""
          className="mx-auto size-28 opacity-90"
        />
        <p className="eyebrow mt-8">404 · Page not found</p>
        <h1 className="mt-3 text-4xl font-medium md:text-5xl">
          This pot seems to have rolled away
        </h1>
        <p className="mt-4 text-lg text-brown-muted">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonClasses('primary', 'lg')}>
            Back to home
          </Link>
          <Link href="/shop" className={buttonClasses('secondary', 'lg')}>
            Browse products
          </Link>
        </div>
      </div>
    </main>
  );
}
