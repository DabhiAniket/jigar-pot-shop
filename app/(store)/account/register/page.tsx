import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RegisterForm } from '@/components/account/auth-forms';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md">
      <p className="eyebrow">Join Jigar Matka House</p>
      <h1 className="mt-3 mb-6 text-4xl font-medium">Create your account</h1>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
