'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { INDIAN_STATES, type CustomerMe, type SavedAddressDTO } from '@jmh/shared';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/misc';
import { api, ClientApiError } from '@/lib/api/client';
import { loadCustomer, signOut, updateCustomer, useCustomer } from '@/lib/customer';

/** Redirects to sign-in when nobody is signed in; returns the customer once known. */
export function useRequireCustomer(next: string) {
  const router = useRouter();
  const { ready, customer } = useCustomer();
  useEffect(() => {
    void loadCustomer({ force: true });
  }, []);
  useEffect(() => {
    if (ready && !customer) router.replace(`/account/login?next=${encodeURIComponent(next)}`);
  }, [ready, customer, router, next]);
  return customer;
}

export function AccountOverview() {
  const router = useRouter();
  const customer = useRequireCustomer('/account');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileFields, setProfileFields] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!customer) return <Skeleton className="h-80" />;

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section aria-labelledby="profile-title">
        <h2 id="profile-title" className="text-2xl font-medium">
          Your details
        </h2>
        <form
          className="mt-4 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setSaving(true);
            setSaved(false);
            setProfileError(null);
            setProfileFields({});
            try {
              const response = await api<{ data: CustomerMe }>('/account/me', {
                method: 'PATCH',
                body: {
                  name: String(data.get('name') ?? '').trim(),
                  phone: String(data.get('phone') ?? '').trim(),
                },
              });
              updateCustomer(response.data);
              setSaved(true);
            } catch (reason) {
              if (reason instanceof ClientApiError) {
                setProfileFields(reason.fields);
                setProfileError(reason.message);
              }
            } finally {
              setSaving(false);
            }
          }}
        >
          <FormError message={profileError} />
          <Field label="Email" hint="Your sign-in email cannot be changed here.">
            {(props) => <Input {...props} value={customer.email} readOnly disabled />}
          </Field>
          <Field label="Full name" required error={profileFields.name}>
            {(props) => (
              <Input {...props} name="name" defaultValue={customer.name} maxLength={80} />
            )}
          </Field>
          <Field label="Mobile number" required error={profileFields.phone}>
            {(props) => <Input {...props} name="phone" type="tel" defaultValue={customer.phone} />}
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={saving}>
              Save details
            </Button>
            {saved ? (
              <span role="status" className="text-sm text-sage">
                Saved
              </span>
            ) : null}
          </div>
        </form>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/account/orders" variant="secondary">
            My orders
          </ButtonLink>
          <Button
            variant="ghost"
            onClick={async () => {
              await signOut();
              router.replace('/');
            }}
          >
            Sign out
          </Button>
        </div>
      </section>

      <AddressBook addresses={customer.addresses} />
    </div>
  );
}

function AddressBook({ addresses }: { addresses: SavedAddressDTO[] }) {
  const [editing, setEditing] = useState<SavedAddressDTO | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  async function run(promise: Promise<{ data: CustomerMe }>) {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      updateCustomer((await promise).data);
      setEditing(null);
    } catch (reason) {
      if (reason instanceof ClientApiError) {
        setFields(reason.fields);
        setError(reason.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="addresses-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="addresses-title" className="text-2xl font-medium">
          Saved addresses
        </h2>
        {editing === null && addresses.length < 10 ? (
          <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>
            Add address
          </Button>
        ) : null}
      </div>
      {addresses.length === 0 && editing === null ? (
        <p className="mt-4 text-brown-muted">
          No saved addresses yet. Add one and checkout will fill it in for you.
        </p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {addresses.map((address) => (
          <li key={address.id} className="rounded-2xl border border-brown/15 p-4">
            <p className="font-semibold">
              {address.label || 'Address'}
              {address.isDefault ? (
                <span className="ml-2 rounded-full bg-sage-soft px-2 py-0.5 text-xs">Default</span>
              ) : null}
            </p>
            <address className="mt-1 text-sm not-italic leading-relaxed text-brown-muted">
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ''}
              {address.landmark ? `, near ${address.landmark}` : ''}
              <br />
              {address.city}, {address.state} {address.pincode}
            </address>
            <div className="mt-2 flex gap-4 text-sm font-semibold">
              <button type="button" onClick={() => setEditing(address)}>
                Edit
              </button>
              <button
                type="button"
                className="text-danger"
                disabled={busy}
                onClick={() => run(api(`/account/addresses/${address.id}`, { method: 'DELETE' }))}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      {editing !== null ? (
        <form
          className="mt-4 grid gap-4 rounded-2xl border border-brown/15 p-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const text = (name: string) => String(data.get(name) ?? '').trim();
            const body = {
              label: text('label') || null,
              line1: text('line1'),
              line2: text('line2') || undefined,
              landmark: text('landmark') || undefined,
              city: text('city'),
              state: text('state'),
              pincode: text('pincode'),
              isDefault: data.get('isDefault') === 'on',
            };
            void run(
              editing === 'new'
                ? api('/account/addresses', { body })
                : api(`/account/addresses/${editing.id}`, { method: 'PUT', body }),
            );
          }}
        >
          <div className="sm:col-span-2">
            <FormError message={error} />
          </div>
          <Field label="Label" hint="e.g. Home, Shop" error={fields.label}>
            {(props) => (
              <Input
                {...props}
                name="label"
                maxLength={40}
                defaultValue={editing === 'new' ? '' : (editing.label ?? '')}
              />
            )}
          </Field>
          <Field label="House / flat, street" required error={fields.line1}>
            {(props) => (
              <Input
                {...props}
                name="line1"
                maxLength={160}
                defaultValue={editing === 'new' ? '' : editing.line1}
              />
            )}
          </Field>
          <Field label="Area / locality" error={fields.line2}>
            {(props) => (
              <Input
                {...props}
                name="line2"
                maxLength={160}
                defaultValue={editing === 'new' ? '' : (editing.line2 ?? '')}
              />
            )}
          </Field>
          <Field label="Landmark" error={fields.landmark}>
            {(props) => (
              <Input
                {...props}
                name="landmark"
                maxLength={120}
                defaultValue={editing === 'new' ? '' : (editing.landmark ?? '')}
              />
            )}
          </Field>
          <Field label="City" required error={fields.city}>
            {(props) => (
              <Input
                {...props}
                name="city"
                maxLength={80}
                defaultValue={editing === 'new' ? '' : editing.city}
              />
            )}
          </Field>
          <Field label="PIN code" required error={fields.pincode}>
            {(props) => (
              <Input
                {...props}
                name="pincode"
                inputMode="numeric"
                maxLength={6}
                defaultValue={editing === 'new' ? '' : editing.pincode}
              />
            )}
          </Field>
          <Field label="State" required error={fields.state} className="sm:col-span-2">
            {(props) => (
              <Select {...props} name="state" defaultValue={editing === 'new' ? '' : editing.state}>
                <option value="" disabled>
                  Select state
                </option>
                {INDIAN_STATES.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </Select>
            )}
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="isDefault"
              defaultChecked={editing !== 'new' && editing.isDefault}
              className="size-4 accent-terracotta"
            />
            Use as my default address
          </label>
          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit" loading={busy}>
              Save address
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      <p className="mt-6 text-xs text-brown-muted">
        Addresses are private to your account.{' '}
        <Link href="/policies/privacy" className="underline">
          Privacy policy
        </Link>
      </p>
    </section>
  );
}
