import type { ReactNode } from 'react';

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main
      id="main"
      className="grain relative flex min-h-dvh items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-md rounded-[2rem] border border-brown/10 bg-cream p-8 shadow-lift">
        {/* eslint-disable-next-line @next/next/no-img-element -- brand asset */}
        <img
          src="/brand/v1/logo-transparent-480.webp"
          width={480}
          height={143}
          alt="Jigar Matka House"
          className="mx-auto h-12 w-auto"
        />
        <h1 className="mt-6 text-center text-2xl font-medium">{title}</h1>
        {description ? (
          <p className="mt-1 text-center text-sm text-brown-muted">{description}</p>
        ) : null}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
