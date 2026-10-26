import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignInForm } from '@/components/account/auth-forms';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-md">
      <p className="eyebrow">Welcome back</p>
      <h1 className="mt-3 mb-6 text-4xl font-medium">Sign in</h1>
      <Suspense>
        <SignInForm />
      </Suspense>
    </div>
  );
}
