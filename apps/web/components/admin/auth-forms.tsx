'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { checkPasswordStrength, type AdminMe } from '@jmh/shared';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input, PasswordInput } from '@/components/ui/form';
import { api, ClientApiError, setCsrfToken } from '@/lib/api/client';

function safeNext(value: string | null): string {
  return value && value.startsWith('/admin') && !value.startsWith('//') ? value : '/admin';
}

export function LoginForm() {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState<string | null>(null);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setLoading(true);
        setError(null);
        try {
          const response = await api<{ data: AdminMe }>('/admin/auth/login', {
            body: {
              email: String(data.get('email') ?? ''),
              password: String(data.get('password') ?? ''),
            },
          });
          // Full navigation so the server layout picks up the new session cookie.
          window.location.assign(
            response.data.mustChangePassword
              ? '/admin/change-password'
              : safeNext(params.get('next')),
          );
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
      <button
        type="button"
        className="w-full text-center text-sm font-semibold text-terracotta-deep"
        onClick={async () => {
          const email =
            (document.querySelector('input[name=email]') as HTMLInputElement | null)?.value ?? '';
          if (!email) {
            setForgot('Enter your email above first.');
            return;
          }
          const response = await api<{ data: { message: string } }>('/admin/auth/forgot-password', {
            body: { email },
          }).catch(() => null);
          setForgot(response?.data.message ?? 'Please try again later.');
        }}
      >
        Forgot password?
      </button>
      {forgot ? (
        <p className="text-center text-sm text-brown-muted" role="status">
          {forgot}
        </p>
      ) : null}
    </form>
  );
}

function PasswordChecklist({ password, email }: { password: string; email?: string }) {
  if (!password) return null;
  const problems = checkPasswordStrength(password, { email });
  return problems.length ? (
    <ul className="space-y-1 text-sm text-danger">
      {problems.map((problem) => (
        <li key={problem}>• {problem}</li>
      ))}
    </ul>
  ) : (
    <p className="text-sm font-medium text-[#3f4d35]">Strong password ✓</p>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-lg">Your password has been reset. All other sessions were signed out.</p>
        <Link href="/admin/login" className="font-semibold text-terracotta-deep">
          Sign in →
        </Link>
      </div>
    );
  }
  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        try {
          await api('/admin/auth/reset-password', { body: { token, newPassword: password } });
          setDone(true);
        } catch (reason) {
          setError(
            reason instanceof ClientApiError ? reason.message : 'Could not reset the password.',
          );
        } finally {
          setLoading(false);
        }
      }}
    >
      {!token ? (
        <FormError message="This reset link is incomplete. Ask a Super Admin for a new one." />
      ) : null}
      <FormError message={error} />
      <Field
        label="New password"
        required
        hint="At least 12 characters, mixing letters, numbers and symbols."
      >
        {(props) => (
          <PasswordInput
            {...props}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
      </Field>
      <PasswordChecklist password={password} />
      <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!token}>
        Set new password
      </Button>
    </form>
  );
}

export function ChangePasswordForm({ email, forced }: { email: string; forced?: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="max-w-md space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (next !== confirm) {
          setFields({ confirm: ['The passwords do not match.'] });
          return;
        }
        setLoading(true);
        setError(null);
        setFields({});
        try {
          await api('/admin/auth/change-password', {
            body: { currentPassword: current, newPassword: next },
          });
          setSaved(true);
          setCurrent('');
          setNext('');
          setConfirm('');
          if (forced) {
            setCsrfToken(null);
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload so the server layout re-reads the session cookie
            window.location.assign('/admin');
          } else router.refresh();
        } catch (reason) {
          if (reason instanceof ClientApiError) {
            setFields(reason.fields);
            setError(reason.message);
          }
        } finally {
          setLoading(false);
        }
      }}
    >
      <FormError message={Object.keys(fields).length ? null : error} />
      {saved && !forced ? (
        <p className="text-sm font-medium text-[#3f4d35]" role="status">
          Password changed. Your other sessions were signed out.
        </p>
      ) : null}
      <Field label="Current password" required error={fields.currentPassword}>
        {(props) => (
          <PasswordInput
            {...props}
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        )}
      </Field>
      <Field label="New password" required error={fields.newPassword}>
        {(props) => (
          <PasswordInput
            {...props}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        )}
      </Field>
      <PasswordChecklist password={next} email={email} />
      <Field label="Confirm new password" required error={fields.confirm}>
        {(props) => (
          <PasswordInput
            {...props}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" loading={loading}>
        Change password
      </Button>
    </form>
  );
}
