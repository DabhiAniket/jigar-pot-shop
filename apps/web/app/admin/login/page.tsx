import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCard } from '@/components/admin/auth-card';
import { LoginForm } from '@/components/admin/auth-forms';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <AuthCard title="Admin sign in" description="Staff access only">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
