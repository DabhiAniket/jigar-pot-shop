'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input, PasswordInput } from '@/components/ui/form';
import { ClientApiError } from '@/lib/api/client';
import { signIn, signUp, useCustomer } from '@/lib/customer';

/** Only same-site, non-admin paths: stops "?next=" being used to bounce people elsewhere. */
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/admin')
    ? value
    : '/account';
}

function useRedirectWhenSignedIn() {
  const router = useRouter();
  const params = useSearchParams();
  const { customer } = useCustomer();
  useEffect(() => {
    if (customer) router.replace(safeNext(params.get('next')));
  }, [customer, params, router]);
}

export function SignInForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useRedirectWhenSignedIn();
  const next = params.get('next');

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setLoading(true);
        setError(null);
        try {
          await signIn(String(data.get('email') ?? ''), String(data.get('password') ?? ''));
          router.replace(safeNext(next));
        } catch (reason) {
          setLoading(false);
          setError(reason instanceof ClientApiError ? reason.message : 'Could not sign in.');
        }
      }}
    >
      <FormError message={error} />
      <Field label="Email" required>
        {(props) => (
          <Input {...props} name="email" type="email" autoComplete="username" autoFocus />
        )}
      </Field>
      <Field label="Password" required>
        {(props) => <PasswordInput {...props} name="password" autoComplete="current-password" />}
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        Sign in
      </Button>
      <p className="text-center text-sm text-brown-muted">
        New here?{' '}
        <Link
          href={next ? `/account/register?next=${encodeURIComponent(next)}` : '/account/register'}
          className="font-semibold text-terracotta-deep"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  useRedirectWhenSignedIn();
  const next = params.get('next');

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setLoading(true);
        setError(null);
        setFields({});
        try {
          await signUp({
            name: String(data.get('name') ?? '').trim(),
            email: String(data.get('email') ?? '').trim(),
            phone: String(data.get('phone') ?? '').trim(),
            password: String(data.get('password') ?? ''),
          });
          router.replace(safeNext(next));
        } catch (reason) {
          setLoading(false);
          if (reason instanceof ClientApiError) {
            setFields(reason.fields);
            setError(reason.message);
          } else setError('Could not create your account.');
        }
      }}
    >
      <FormError message={error} />
      <Field label="Full name" required error={fields.name}>
        {(props) => <Input {...props} name="name" autoComplete="name" maxLength={80} autoFocus />}
      </Field>
      <Field label="Email" required error={fields.email}>
        {(props) => <Input {...props} name="email" type="email" autoComplete="email" />}
      </Field>
      <Field label="Mobile number" required error={fields.phone} hint="10-digit Indian mobile.">
        {(props) => (
          <Input {...props} name="phone" type="tel" inputMode="tel" autoComplete="tel-national" />
        )}
      </Field>
      <Field
        label="Password"
        required
        error={fields.password}
        hint="At least 12 characters. Avoid your name or email."
      >
        {(props) => <PasswordInput {...props} name="password" autoComplete="new-password" />}
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        Create account
      </Button>
      <p className="text-center text-sm text-brown-muted">
        Already have an account?{' '}
        <Link
          href={next ? `/account/login?next=${encodeURIComponent(next)}` : '/account/login'}
          className="font-semibold text-terracotta-deep"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
