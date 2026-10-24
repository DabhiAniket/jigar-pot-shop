import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCard } from '@/components/admin/auth-card';
import { ResetPasswordForm } from '@/components/admin/auth-forms';

export const metadata: Metadata = { title: 'Reset password', referrer: 'no-referrer' };

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Choose a new password"
      description="Reset links expire after 30 minutes and work once."
    >
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
