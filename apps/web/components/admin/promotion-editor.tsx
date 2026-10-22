'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type {
  AdminProductDetail,
  AdminProductListItem,
  AdminPromotion,
  Paginated,
} from '@jmh/shared';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Checkbox, Field, FormError, Input, Select, Textarea } from '@/components/ui/form';
import { api } from '@/lib/api/client';
import { useAdmin, useMutation } from './admin-context';
import { Card } from './ui';

const IST_OFFSET_MS = 5.5 * 3_600_000;

/** ISO instant → value for <input type="datetime-local"> shown in India time. */
function toLocalInput(iso: string): string {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}
/** datetime-local value (India time) → ISO with explicit offset. */
function fromLocalInput(value: string): string {
  return value ? `${value}:00+05:30` : '';
}

const rupees = (paise: number | null | undefined) => (paise == null ? '' : String(paise / 100));
const toPaise = (value: string) => (value.trim() === '' ? null : Math.round(Number(value) * 100));

export function PromotionEditor({
  promotion,
  categories,
}: {
  promotion: AdminPromotion | null;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { can } = useAdmin();
  const save = useMutation();
  const remove = useMutation();
  const readOnly = !can('promotions:write');
  const now = new Date();

  const [name, setName] = useState(promotion?.name ?? '');
  const [description, setDescription] = useState(promotion?.description ?? '');
  const [type, setType] = useState(promotion?.type ?? 'percentage');
  const [value, setValue] = useState(
    promotion
      ? promotion.type === 'percentage'
        ? String(promotion.value)
        : rupees(promotion.value)
      : '',
  );
  const [maxDiscount, setMaxDiscount] = useState(rupees(promotion?.maxDiscount));
  const [minOrderValue, setMinOrderValue] = useState(rupees(promotion?.minOrderValue));
  const [scope, setScope] = useState(promotion?.scope ?? 'all');
  const [categoryIds, setCategoryIds] = useState<string[]>(promotion?.categoryIds ?? []);
  const [products, setProducts] = useState<{ id: string; name: string }[]>(
    (promotion?.productIds ?? []).map((id) => ({ id, name: `Product …${id.slice(-6)}` })),
  );
  const [code, setCode] = useState(promotion?.code ?? '');
  const [startsAt, setStartsAt] = useState(toLocalInput(promotion?.startsAt ?? now.toISOString()));
  const [endsAt, setEndsAt] = useState(
    toLocalInput(promotion?.endsAt ?? new Date(now.getTime() + 7 * 86_400_000).toISOString()),
  );
  const [isActive, setIsActive] = useState(promotion?.isActive ?? true);
  const [priority, setPriority] = useState(String(promotion?.priority ?? 0));
  const [bannerShow, setBannerShow] = useState(promotion?.banner.show ?? false);
  const [bannerHeadline, setBannerHeadline] = useState(promotion?.banner.headline ?? '');
  const [bannerSubtext, setBannerSubtext] = useState(promotion?.banner.subtext ?? '');
  const [ctaLabel, setCtaLabel] = useState(promotion?.banner.ctaLabel ?? '');
  const [ctaHref, setCtaHref] = useState(promotion?.banner.ctaHref ?? '');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<AdminProductListItem[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Resolve names of products already attached to the promotion.
  useEffect(() => {
    const ids = (promotion?.productIds ?? []).slice(0, 50);
    if (ids.length === 0) return;
    let active = true;
    Promise.all(
      ids.map((id) =>
        api<{ data: AdminProductDetail }>(`/admin/products/${id}`)
          .then((r) => ({ id, name: r.data.name }))
          .catch(() => null),
      ),
    ).then((found) => {
      if (!active) return;
      const names = new Map(
        found.filter((item) => item !== null).map((item) => [item.id, item.name]),
      );
      setProducts((current) =>
        current.map((item) => ({ ...item, name: names.get(item.id) ?? item.name })),
      );
    });
    return () => {
      active = false;
    };
  }, [promotion?.productIds]);

  useEffect(() => {
    if (scope !== 'products' || search.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<Paginated<AdminProductListItem>>(
        `/admin/products?q=${encodeURIComponent(search.trim())}&limit=10`,
        { signal: controller.signal },
      )
        .then((response) => setResults(response.data))
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, scope]);

  const err = (path: string) => save.fieldErrors[path];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = {
      name,
      description,
      type,
      value: type === 'percentage' ? Math.round(Number(value || 0)) : (toPaise(value) ?? 0),
      maxDiscount: type === 'percentage' ? toPaise(maxDiscount) : null,
      minOrderValue: toPaise(minOrderValue),
      scope,
      categoryIds: scope === 'categories' ? categoryIds : [],
      productIds: scope === 'products' ? products.map((product) => product.id) : [],
      code: code || null,
      startsAt: fromLocalInput(startsAt),
      endsAt: fromLocalInput(endsAt),
      isActive,
      priority: Number(priority || 0),
      banner: {
        show: bannerShow,
        headline: bannerHeadline || null,
        subtext: bannerSubtext || null,
        ctaLabel: ctaLabel || null,
        ctaHref: ctaHref || null,
      },
    };
    const result = promotion
      ? await save.run<{ data: AdminPromotion }>(`/promotions/${promotion.id}`, {
          method: 'PUT',
          body,
          success: 'Promotion saved',
        })
      : await save.run<{ data: AdminPromotion }>('/promotions', {
          body,
          success: 'Promotion created',
          refresh: false,
        });
    if (result && !promotion) router.push(`/admin/promotions/${result.data.id}`);
  };

  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-3" noValidate>
      <fieldset disabled={readOnly} className="contents">
        <div className="space-y-6 xl:col-span-2">
          <FormError
            message={
              Object.keys(save.fieldErrors).length
                ? 'Please correct the highlighted fields.'
                : save.error
            }
          />
          <Card title="Offer">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" required error={err('name')} className="md:col-span-2">
                {(props) => (
                  <Input
                    {...props}
                    value={name}
                    maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Diwali Dhamaka"
                  />
                )}
              </Field>
              <Field
                label="Internal description"
                error={err('description')}
                className="md:col-span-2"
              >
                {(props) => (
                  <Textarea
                    {...props}
                    value={description}
                    maxLength={500}
                    className="min-h-20"
                    onChange={(e) => setDescription(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Discount type" error={err('type')}>
                {(props) => (
                  <Select
                    {...props}
                    value={type}
                    onChange={(e) => setType(e.target.value as typeof type)}
                  >
                    <option value="percentage">Percentage off</option>
                    <option value="fixed_amount">Fixed amount off (₹)</option>
                  </Select>
                )}
              </Field>
              <Field
                label={type === 'percentage' ? 'Percent (1–90)' : 'Amount (₹)'}
                required
                error={err('value')}
              >
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    min={1}
                    step={type === 'percentage' ? 1 : '0.01'}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                )}
              </Field>
              {type === 'percentage' ? (
                <Field label="Maximum discount (₹)" error={err('maxDiscount')} hint="Optional cap.">
                  {(props) => (
                    <Input
                      {...props}
                      type="number"
                      min={0}
                      step="0.01"
                      value={maxDiscount}
                      onChange={(e) => setMaxDiscount(e.target.value)}
                    />
                  )}
                </Field>
              ) : null}
              <Field label="Minimum order value (₹)" error={err('minOrderValue')} hint="Optional.">
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    min={0}
                    step="0.01"
                    value={minOrderValue}
                    onChange={(e) => setMinOrderValue(e.target.value)}
                  />
                )}
              </Field>
              <Field
                label="Promo code"
                error={err('code')}
                hint="Leave empty to apply automatically to eligible carts."
              >
                {(props) => (
                  <Input
                    {...props}
                    value={code}
                    maxLength={20}
                    onChange={(e) =>
                      setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                    }
                  />
                )}
              </Field>
              <p className="text-xs leading-relaxed text-brown-muted md:col-span-2">
                Only one promotion applies per order — customers automatically get the best eligible
                one.
              </p>
            </div>
          </Card>

          <Card title="Eligible products">
            <fieldset className="space-y-2 text-sm">
              <legend className="sr-only">Scope</legend>
              {(
                [
                  ['all', 'Entire catalogue'],
                  ['categories', 'Selected categories'],
                  ['products', 'Selected products'],
                ] as const
              ).map(([valueOption, label]) => (
                <label key={valueOption} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === valueOption}
                    onChange={() => setScope(valueOption)}
                    className="accent-terracotta"
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            {scope === 'categories' ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {categories.map((category) => (
                  <Checkbox
                    key={category.id}
                    label={category.name}
                    checked={categoryIds.includes(category.id)}
                    onChange={(e) =>
                      setCategoryIds((current) =>
                        e.target.checked
                          ? [...current, category.id]
                          : current.filter((id) => id !== category.id),
                      )
                    }
                  />
                ))}
                {err('categoryIds') ? (
                  <p className="text-sm text-danger sm:col-span-2">{err('categoryIds')![0]}</p>
                ) : null}
              </div>
            ) : null}
            {scope === 'products' ? (
              <div className="mt-4 space-y-3">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products by name or SKU…"
                  aria-label="Search products to add"
                />
                {results.length && search.trim().length >= 2 ? (
                  <ul className="max-h-56 overflow-y-auto rounded-xl border border-brown/10">
                    {results.map((product) => (
                      <li key={product.id}>
                        <button
                          type="button"
                          className="flex w-full justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-cream disabled:opacity-40"
                          disabled={products.some((item) => item.id === product.id)}
                          onClick={() =>
                            setProducts((current) => [
                              ...current,
                              { id: product.id, name: product.name },
                            ])
                          }
                        >
                          {product.name}
                          <span className="text-terracotta-deep">Add</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <ul className="flex flex-wrap gap-2">
                  {products.map((product) => (
                    <li
                      key={product.id}
                      className="flex items-center gap-2 rounded-full bg-cream px-3 py-1 text-sm"
                    >
                      {product.name}
                      <button
                        type="button"
                        aria-label={`Remove ${product.name}`}
                        onClick={() =>
                          setProducts((current) => current.filter((item) => item.id !== product.id))
                        }
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                {err('productIds') ? (
                  <p className="text-sm text-danger">{err('productIds')![0]}</p>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card title="Homepage banner">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Checkbox
                  label="Show a banner while this promotion is live"
                  checked={bannerShow}
                  onChange={(e) => setBannerShow(e.target.checked)}
                />
              </div>
              <Field label="Headline" error={err('banner.headline')} className="md:col-span-2">
                {(props) => (
                  <Input
                    {...props}
                    value={bannerHeadline}
                    maxLength={80}
                    onChange={(e) => setBannerHeadline(e.target.value)}
                    placeholder="Diwali Dhamaka — Up to 30% OFF"
                  />
                )}
              </Field>
              <Field
                label="Supporting text"
                error={err('banner.subtext')}
                className="md:col-span-2"
              >
                {(props) => (
                  <Input
                    {...props}
                    value={bannerSubtext}
                    maxLength={160}
                    onChange={(e) => setBannerSubtext(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Button label" error={err('banner.ctaLabel')}>
                {(props) => (
                  <Input
                    {...props}
                    value={ctaLabel}
                    maxLength={40}
                    onChange={(e) => setCtaLabel(e.target.value)}
                  />
                )}
              </Field>
              <Field
                label="Button link"
                error={err('banner.ctaHref')}
                hint="e.g. /collections/festival-collection"
              >
                {(props) => (
                  <Input
                    {...props}
                    value={ctaHref}
                    maxLength={300}
                    onChange={(e) => setCtaHref(e.target.value)}
                  />
                )}
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Schedule">
            <div className="space-y-4">
              <Field label="Starts (India time)" required error={err('startsAt')}>
                {(props) => (
                  <Input
                    {...props}
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Ends (India time)" required error={err('endsAt')}>
                {(props) => (
                  <Input
                    {...props}
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                )}
              </Field>
              <Field
                label="Priority"
                error={err('priority')}
                hint="Breaks ties between equally good offers."
              >
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    min={0}
                    max={100}
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  />
                )}
              </Field>
              <Checkbox
                label="Enabled"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              {!readOnly ? (
                <Button type="submit" className="w-full" loading={save.busy}>
                  {promotion ? 'Save promotion' : 'Create promotion'}
                </Button>
              ) : null}
              {promotion && !readOnly ? (
                <Button
                  variant="ghost"
                  className="w-full text-danger"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete promotion
                </Button>
              ) : null}
            </div>
          </Card>
        </div>
      </fieldset>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this promotion?"
        destructive
        confirmLabel="Delete"
        message="Existing orders keep the discount they received. Consider disabling it instead to keep a record."
        busy={remove.busy}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!promotion) return;
          const result = await remove.run(`/promotions/${promotion.id}`, {
            method: 'DELETE',
            success: 'Promotion deleted',
            refresh: false,
          });
          setConfirmDelete(false);
          if (result !== null) router.push('/admin/promotions');
        }}
      />
    </form>
  );
}
