'use client';

import { useState } from 'react';
import { INDIAN_STATES, WEEKDAYS, type StoreSettingsInput } from '@jmh/shared';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FormError, Input, Select, Textarea } from '@/components/ui/form';
import { useAdmin, useMutation } from './admin-context';
import { Card } from './ui';

export type SettingsData = StoreSettingsInput & { whatsappFallbackFromEnv: string | null };

const rupees = (paise: number | null | undefined) => (paise == null ? '' : String(paise / 100));
const toPaise = (value: string) => (value.trim() === '' ? null : Math.round(Number(value) * 100));
const DAY_LABEL: Record<(typeof WEEKDAYS)[number], string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};
const POLICIES = [
  ['shipping', 'Shipping & delivery policy'],
  ['returns', 'Returns & refunds policy'],
  ['privacy', 'Privacy policy'],
  ['terms', 'Terms & conditions'],
] as const;

export function SettingsEditor({ settings }: { settings: SettingsData }) {
  const { can } = useAdmin();
  const { run, busy, error, fieldErrors } = useMutation();
  const readOnly = !can('settings:write');
  const [s, setS] = useState(settings);
  const [flatCharge, setFlatCharge] = useState(rupees(settings.delivery.flatCharge));
  const [threshold, setThreshold] = useState(rupees(settings.delivery.freeDeliveryThreshold));
  const [hours, setHours] = useState(
    WEEKDAYS.map(
      (day) =>
        settings.openingHours.find((entry) => entry.day === day) ?? {
          day,
          isOpen: false,
          opens: '09:00',
          closes: '20:00',
        },
    ),
  );
  const err = (path: string) => fieldErrors[path];
  const set = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) =>
    setS((current) => ({ ...current, [key]: value }));
  const text = (value: string | null | undefined) => value ?? '';

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const body = {
          storeName: s.storeName,
          legalName: s.legalName,
          tagline: s.tagline,
          phone: s.phone,
          whatsappNumber: s.whatsappNumber,
          email: s.email,
          gstin: s.gstin,
          address: s.address,
          openingHours: hours.some((entry) => entry.isOpen) ? hours : [],
          social: s.social,
          delivery: {
            ...s.delivery,
            flatCharge: toPaise(flatCharge) ?? 0,
            freeDeliveryThreshold: toPaise(threshold),
          },
          policies: s.policies,
          seo: s.seo,
        };
        await run('/settings', { method: 'PUT', body, success: 'Settings saved' });
      }}
    >
      <fieldset disabled={readOnly} className="space-y-6">
        <FormError
          message={
            Object.keys(fieldErrors).length ? 'Please correct the highlighted fields.' : error
          }
        />
        <p className="rounded-2xl bg-gold/15 px-4 py-3 text-sm">
          Only details entered here are shown on the website. Leave anything you do not want to
          publish empty — nothing is invented.
        </p>
        <Card title="Store">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Store name" required error={err('storeName')}>
              {(props) => (
                <Input
                  {...props}
                  value={s.storeName}
                  maxLength={80}
                  onChange={(e) => set('storeName', e.target.value)}
                />
              )}
            </Field>
            <Field label="Legal business name" error={err('legalName')}>
              {(props) => (
                <Input
                  {...props}
                  value={text(s.legalName)}
                  maxLength={120}
                  onChange={(e) => set('legalName', e.target.value)}
                />
              )}
            </Field>
            <Field label="Tagline" error={err('tagline')} className="md:col-span-2">
              {(props) => (
                <Input
                  {...props}
                  value={text(s.tagline)}
                  maxLength={160}
                  onChange={(e) => set('tagline', e.target.value)}
                />
              )}
            </Field>
            <Field label="Phone" error={err('phone')}>
              {(props) => (
                <Input
                  {...props}
                  type="tel"
                  value={text(s.phone)}
                  maxLength={20}
                  onChange={(e) => set('phone', e.target.value)}
                />
              )}
            </Field>
            <Field
              label="WhatsApp business number"
              error={err('whatsappNumber')}
              hint={`International format, e.g. 91XXXXXXXXXX. ${settings.whatsappFallbackFromEnv ? `When empty, the server default ${settings.whatsappFallbackFromEnv} is used.` : 'When empty, WhatsApp ordering is disabled.'}`}
            >
              {(props) => (
                <Input
                  {...props}
                  type="tel"
                  value={text(s.whatsappNumber)}
                  maxLength={20}
                  onChange={(e) => set('whatsappNumber', e.target.value)}
                />
              )}
            </Field>
            <Field label="Email" error={err('email')}>
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  value={text(s.email)}
                  maxLength={120}
                  onChange={(e) => set('email', e.target.value)}
                />
              )}
            </Field>
            <Field label="GSTIN" error={err('gstin')}>
              {(props) => (
                <Input
                  {...props}
                  value={text(s.gstin)}
                  maxLength={15}
                  onChange={(e) => set('gstin', e.target.value.toUpperCase())}
                />
              )}
            </Field>
          </div>
        </Card>

        <Card title="Address">
          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                ['line1', 'Address line 1', 160],
                ['line2', 'Address line 2', 160],
                ['city', 'City', 80],
                ['pincode', 'PIN code', 6],
              ] as const
            ).map(([key, label, max]) => (
              <Field key={key} label={label} error={err(`address.${key}`)}>
                {(props) => (
                  <Input
                    {...props}
                    value={text(s.address[key])}
                    maxLength={max}
                    onChange={(e) => set('address', { ...s.address, [key]: e.target.value })}
                  />
                )}
              </Field>
            ))}
            <Field label="State" error={err('address.state')}>
              {(props) => (
                <Select
                  {...props}
                  value={text(s.address.state)}
                  onChange={(e) =>
                    set('address', {
                      ...s.address,
                      state: (e.target.value || null) as SettingsData['address']['state'],
                    })
                  }
                >
                  <option value="">Not set</option>
                  {INDIAN_STATES.map((state) => (
                    <option key={state}>{state}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Google Maps link" error={err('address.mapUrl')}>
              {(props) => (
                <Input
                  {...props}
                  type="url"
                  value={text(s.address.mapUrl)}
                  onChange={(e) => set('address', { ...s.address, mapUrl: e.target.value })}
                />
              )}
            </Field>
          </div>
        </Card>

        <Card title="Opening hours">
          <ul className="space-y-2">
            {hours.map((entry, index) => (
              <li key={entry.day} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="w-24 font-semibold">{DAY_LABEL[entry.day]}</span>
                <Checkbox
                  label="Open"
                  checked={entry.isOpen}
                  onChange={(e) =>
                    setHours((current) =>
                      current.map((h, i) => (i === index ? { ...h, isOpen: e.target.checked } : h)),
                    )
                  }
                />
                <label className="flex items-center gap-1">
                  <span className="sr-only">{DAY_LABEL[entry.day]} opens</span>
                  <input
                    type="time"
                    value={entry.opens}
                    disabled={!entry.isOpen}
                    onChange={(e) =>
                      setHours((current) =>
                        current.map((h, i) => (i === index ? { ...h, opens: e.target.value } : h)),
                      )
                    }
                    className="h-9 rounded-lg border border-brown/20 px-2"
                  />
                </label>
                –
                <label className="flex items-center gap-1">
                  <span className="sr-only">{DAY_LABEL[entry.day]} closes</span>
                  <input
                    type="time"
                    value={entry.closes}
                    disabled={!entry.isOpen}
                    onChange={(e) =>
                      setHours((current) =>
                        current.map((h, i) => (i === index ? { ...h, closes: e.target.value } : h)),
                      )
                    }
                    className="h-9 rounded-lg border border-brown/20 px-2"
                  />
                </label>
              </li>
            ))}
          </ul>
          {Object.keys(fieldErrors).some((key) => key.startsWith('openingHours')) ? (
            <p className="mt-2 text-sm text-danger">Use HH:MM times for open days.</p>
          ) : null}
        </Card>

        <Card title="Delivery & pickup">
          <div className="grid gap-4 md:grid-cols-2">
            <Checkbox
              label="Home delivery available"
              checked={s.delivery.deliveryEnabled}
              onChange={(e) =>
                set('delivery', { ...s.delivery, deliveryEnabled: e.target.checked })
              }
            />
            <Checkbox
              label="Store pickup available"
              checked={s.delivery.pickupEnabled}
              onChange={(e) => set('delivery', { ...s.delivery, pickupEnabled: e.target.checked })}
            />
            <Field label="Delivery charge (₹)" error={err('delivery.flatCharge')}>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={0}
                  step="0.01"
                  value={flatCharge}
                  onChange={(e) => setFlatCharge(e.target.value)}
                />
              )}
            </Field>
            <Field
              label="Free delivery from (₹)"
              error={err('delivery.freeDeliveryThreshold')}
              hint="Leave empty for no free-delivery threshold."
            >
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={0}
                  step="0.01"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              )}
            </Field>
            <Field
              label="Delivery note"
              error={err('delivery.note')}
              className="md:col-span-2"
              hint="Shown in the announcement bar and at checkout, e.g. delivery areas."
            >
              {(props) => (
                <Input
                  {...props}
                  value={text(s.delivery.note)}
                  maxLength={300}
                  onChange={(e) => set('delivery', { ...s.delivery, note: e.target.value })}
                />
              )}
            </Field>
          </div>
        </Card>

        <Card title="Social media">
          <div className="grid gap-4 md:grid-cols-2">
            {(['instagram', 'facebook', 'youtube', 'x'] as const).map((key) => (
              <Field
                key={key}
                label={key === 'x' ? 'X (Twitter)' : key[0]!.toUpperCase() + key.slice(1)}
                error={err(`social.${key}`)}
              >
                {(props) => (
                  <Input
                    {...props}
                    type="url"
                    value={text(s.social[key])}
                    onChange={(e) => set('social', { ...s.social, [key]: e.target.value })}
                  />
                )}
              </Field>
            ))}
          </div>
        </Card>

        <Card title="Policies">
          <p className="mb-4 text-sm text-brown-muted">
            Plain text; blank lines start new paragraphs and lines starting with “## ” become
            headings. Empty policies are marked as not yet published.
          </p>
          <div className="space-y-4">
            {POLICIES.map(([key, label]) => (
              <Field key={key} label={label} error={err(`policies.${key}`)}>
                {(props) => (
                  <Textarea
                    {...props}
                    value={s.policies[key]}
                    maxLength={20_000}
                    className="min-h-40"
                    onChange={(e) => set('policies', { ...s.policies, [key]: e.target.value })}
                  />
                )}
              </Field>
            ))}
          </div>
        </Card>

        <Card title="Search engine defaults">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Default title" error={err('seo.defaultTitle')}>
              {(props) => (
                <Input
                  {...props}
                  value={text(s.seo.defaultTitle)}
                  maxLength={70}
                  onChange={(e) => set('seo', { ...s.seo, defaultTitle: e.target.value })}
                />
              )}
            </Field>
            <Field label="Default description" error={err('seo.defaultDescription')}>
              {(props) => (
                <Textarea
                  {...props}
                  value={text(s.seo.defaultDescription)}
                  maxLength={170}
                  className="min-h-20"
                  onChange={(e) => set('seo', { ...s.seo, defaultDescription: e.target.value })}
                />
              )}
            </Field>
          </div>
        </Card>

        {!readOnly ? (
          <div className="sticky bottom-4 flex justify-end">
            <Button type="submit" size="lg" loading={busy} className="shadow-lift">
              Save settings
            </Button>
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}
