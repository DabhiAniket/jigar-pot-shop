'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  AVAILABILITY,
  AVAILABILITY_LABELS,
  slugify,
  type AdminProductDetail,
  type ImageDTO,
  type ProductSpecs,
} from '@jmh/shared';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FormError, Input, Select, Textarea } from '@/components/ui/form';
import { useAdmin, useMutation } from './admin-context';
import { ImageUploadDialog } from './image-uploader';
import { MediaPicker } from './media-picker';
import { Card } from './ui';

interface VariantRow {
  id?: string;
  name: string;
  sku: string;
  price: string;
  salePrice: string;
  stock: string;
  isActive: boolean;
}

const rupees = (paise: number | null | undefined) => (paise == null ? '' : String(paise / 100));
const toPaise = (value: string) => (value.trim() === '' ? null : Math.round(Number(value) * 100));
const num = (value: string) => (value.trim() === '' ? null : Number(value));

const SPEC_FIELDS: [keyof ProductSpecs, string, 'text' | 'number'][] = [
  ['material', 'Material', 'text'],
  ['finish', 'Finish', 'text'],
  ['color', 'Colour', 'text'],
  ['capacityLitres', 'Capacity (litres)', 'number'],
  ['heightCm', 'Height (cm)', 'number'],
  ['diameterCm', 'Diameter (cm)', 'number'],
  ['widthCm', 'Width (cm)', 'number'],
  ['depthCm', 'Depth (cm)', 'number'],
  ['weightKg', 'Weight (kg)', 'number'],
];

export function ProductEditor({
  product,
  categories,
}: {
  product: AdminProductDetail | null;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { can } = useAdmin();
  const { run, busy, error, fieldErrors } = useMutation();
  const readOnly = !can('products:write');

  const [name, setName] = useState(product?.name ?? '');
  const [nameGu, setNameGu] = useState(product?.nameGu ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [sku, setSku] = useState(product?.sku ?? '');
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '');
  const [shortDescription, setShortDescription] = useState(product?.shortDescription ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(rupees(product?.price));
  const [salePrice, setSalePrice] = useState(rupees(product?.salePrice));
  const [trackInventory, setTrackInventory] = useState(product?.trackInventory ?? true);
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(product?.lowStockThreshold ?? 3),
  );
  const [availability, setAvailability] = useState(product?.availability ?? 'in_stock');
  const [images, setImages] = useState<ImageDTO[]>(product?.images ?? []);
  const [variants, setVariants] = useState<VariantRow[]>(
    (product?.variants ?? []).map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku ?? '',
      price: rupees(variant.price),
      salePrice: rupees(variant.salePrice),
      stock: String(variant.stock),
      isActive: variant.isActive,
    })),
  );
  const [specs, setSpecs] = useState<Record<keyof ProductSpecs, string>>(
    Object.fromEntries(
      SPEC_FIELDS.map(([key]) => [
        key,
        product?.specs[key] == null ? '' : String(product.specs[key]),
      ]),
    ) as Record<keyof ProductSpecs, string>,
  );
  const [shippingInfo, setShippingInfo] = useState(product?.shippingInfo ?? '');
  const [tags, setTags] = useState((product?.tags ?? []).join(', '));
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [isBestseller, setIsBestseller] = useState(product?.isBestseller ?? false);
  const [status, setStatus] = useState(product?.status ?? 'draft');
  const [seoTitle, setSeoTitle] = useState(product?.seo.title ?? '');
  const [seoDescription, setSeoDescription] = useState(product?.seo.description ?? '');
  const [picker, setPicker] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);

  const err = (path: string) => fieldErrors[path];
  const variantErr = (index: number) =>
    Object.entries(fieldErrors)
      .filter(([key]) => key.startsWith(`variants.${index}`))
      .flatMap(([, messages]) => messages)[0];

  const moveImage = (index: number, delta: number) =>
    setImages((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(Math.max(0, Math.min(next.length, index + delta)), 0, item!);
      return next;
    });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const body = {
      name,
      nameGu: nameGu || null,
      slug: slug || undefined,
      sku: sku || null,
      categoryId: categoryId || null,
      shortDescription,
      description,
      price: toPaise(price) ?? 0,
      salePrice: toPaise(salePrice),
      trackInventory,
      stock: Number(stock || 0),
      lowStockThreshold: Number(lowStockThreshold || 0),
      availability,
      images: images.map((image) => ({ assetId: image.assetId, alt: image.alt })),
      variants: variants.map((variant) => ({
        ...(variant.id ? { id: variant.id } : {}),
        name: variant.name,
        sku: variant.sku || null,
        price: toPaise(variant.price),
        salePrice: toPaise(variant.salePrice),
        stock: Number(variant.stock || 0),
        isActive: variant.isActive,
      })),
      specs: Object.fromEntries(
        SPEC_FIELDS.map(([key, , type]) => [
          key,
          type === 'number' ? num(specs[key]) : specs[key] || null,
        ]),
      ),
      shippingInfo,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      isFeatured,
      isBestseller,
      status,
      seo: { title: seoTitle || null, description: seoDescription || null },
      ...(product ? { version: product.updatedAt } : {}),
    };
    const result = product
      ? await run<{ data: AdminProductDetail }>(`/products/${product.id}`, {
          method: 'PUT',
          body,
          success: 'Product saved',
        })
      : await run<{ data: AdminProductDetail }>('/products', {
          body,
          success: 'Product created',
          refresh: false,
        });
    if (result && !product) router.push(`/admin/products/${result.data.id}`);
  }

  return (
    <form onSubmit={save} className="grid gap-6 xl:grid-cols-3" noValidate>
      <fieldset disabled={readOnly} className="contents">
        <div className="space-y-6 xl:col-span-2">
          <FormError message={error} />
          <Card title="Basics">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Product name" required error={err('name')} className="md:col-span-2">
                {(props) => (
                  <Input
                    {...props}
                    value={name}
                    maxLength={140}
                    onChange={(event) => {
                      setName(event.target.value);
                      if (!slugTouched) setSlug(slugify(event.target.value));
                    }}
                  />
                )}
              </Field>
              <Field label="Name in Gujarati" error={err('nameGu')}>
                {(props) => (
                  <Input
                    {...props}
                    lang="gu"
                    value={nameGu}
                    maxLength={140}
                    onChange={(event) => setNameGu(event.target.value)}
                  />
                )}
              </Field>
              <Field
                label="URL slug"
                error={err('slug')}
                hint={
                  product
                    ? 'Changing it keeps a redirect from the old address.'
                    : 'Generated from the name.'
                }
              >
                {(props) => (
                  <Input
                    {...props}
                    value={slug}
                    maxLength={80}
                    onChange={(event) => {
                      setSlugTouched(true);
                      setSlug(event.target.value.toLowerCase());
                    }}
                  />
                )}
              </Field>
              <Field label="SKU" error={err('sku')}>
                {(props) => (
                  <Input
                    {...props}
                    value={sku}
                    maxLength={64}
                    onChange={(event) => setSku(event.target.value.toUpperCase())}
                  />
                )}
              </Field>
              <Field label="Category" error={err('categoryId')}>
                {(props) => (
                  <Select
                    {...props}
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                  >
                    <option value="">Uncategorised</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field
                label="Short description"
                error={err('shortDescription')}
                className="md:col-span-2"
                hint="Shown under the title and in search results (max 300 characters)."
              >
                {(props) => (
                  <Textarea
                    {...props}
                    value={shortDescription}
                    maxLength={300}
                    className="min-h-20"
                    onChange={(event) => setShortDescription(event.target.value)}
                  />
                )}
              </Field>
              <Field label="Full description" error={err('description')} className="md:col-span-2">
                {(props) => (
                  <Textarea
                    {...props}
                    value={description}
                    maxLength={8000}
                    className="min-h-40"
                    onChange={(event) => setDescription(event.target.value)}
                  />
                )}
              </Field>
            </div>
          </Card>

          <Card
            title="Images"
            actions={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPicker(true)}
                disabled={images.length >= 12}
              >
                Add image
              </Button>
            }
          >
            {err('images') || Object.keys(fieldErrors).some((key) => key.startsWith('images.')) ? (
              <p className="mb-3 text-sm font-medium text-danger">
                {err('images')?.[0] ?? 'One of the images is not available.'}
              </p>
            ) : null}
            {images.length === 0 ? (
              <p className="text-sm text-brown-muted">
                No images yet. The first image is used on product cards. At least one image is
                required to publish.
              </p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {images.map((image, index) => (
                  <li key={image.assetId} className="rounded-2xl border border-brown/10 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- pipeline variant */}
                    <img
                      src={image.variants[1]?.url ?? image.variants[0]?.url}
                      alt={image.alt}
                      className="aspect-square w-full rounded-xl bg-cream-deep object-contain"
                    />
                    <label className="mt-2 block text-xs font-semibold">
                      Alt text
                      <input
                        value={image.alt}
                        maxLength={200}
                        onChange={(event) =>
                          setImages((current) =>
                            current.map((item, i) =>
                              i === index ? { ...item, alt: event.target.value } : item,
                            ),
                          )
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-brown/20 px-2 text-sm font-normal"
                      />
                    </label>
                    <div className="mt-2 flex items-center justify-between text-xs font-semibold">
                      <span className="text-brown-muted">
                        {index === 0 ? 'Main image' : `#${index + 1}`}
                      </span>
                      <span className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => moveImage(index, -1)}
                          disabled={index === 0}
                          aria-label="Move image earlier"
                          className="disabled:opacity-30"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(index, 1)}
                          disabled={index === images.length - 1}
                          aria-label="Move image later"
                          className="disabled:opacity-30"
                        >
                          →
                        </button>
                        <button type="button" onClick={() => setEditIndex(index)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSwapIndex(index);
                            setPicker(true);
                          }}
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setImages((current) => current.filter((_, i) => i !== index))
                          }
                          className="text-danger"
                        >
                          Remove
                        </button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Pricing & stock">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Price (₹)" required error={err('price')}>
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                  />
                )}
              </Field>
              <Field
                label="Sale price (₹)"
                error={err('salePrice')}
                hint="Leave empty when not on sale."
              >
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={salePrice}
                    onChange={(event) => setSalePrice(event.target.value)}
                  />
                )}
              </Field>
              <Field label="Availability" error={err('availability')}>
                {(props) => (
                  <Select
                    {...props}
                    value={availability}
                    onChange={(event) => setAvailability(event.target.value as typeof availability)}
                  >
                    {AVAILABILITY.map((value) => (
                      <option key={value} value={value}>
                        {AVAILABILITY_LABELS[value]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <div className="md:col-span-3">
                <Checkbox
                  label="Track stock for this product"
                  checked={trackInventory}
                  onChange={(event) => setTrackInventory(event.target.checked)}
                />
              </div>
              {trackInventory && variants.length === 0 ? (
                <Field
                  label="Stock quantity"
                  error={err('stock')}
                  hint="Edits are recorded in the inventory log."
                >
                  {(props) => (
                    <Input
                      {...props}
                      type="number"
                      min={0}
                      step={1}
                      value={stock}
                      onChange={(event) => setStock(event.target.value)}
                    />
                  )}
                </Field>
              ) : null}
              {trackInventory ? (
                <Field label="Low-stock alert at" error={err('lowStockThreshold')}>
                  {(props) => (
                    <Input
                      {...props}
                      type="number"
                      min={0}
                      step={1}
                      value={lowStockThreshold}
                      onChange={(event) => setLowStockThreshold(event.target.value)}
                    />
                  )}
                </Field>
              ) : null}
            </div>
          </Card>

          <Card
            title="Variants"
            actions={
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setVariants((current) => [
                    ...current,
                    { name: '', sku: '', price: '', salePrice: '', stock: '0', isActive: true },
                  ])
                }
              >
                Add variant
              </Button>
            }
          >
            {variants.length === 0 ? (
              <p className="text-sm text-brown-muted">
                Optional — e.g. sizes such as “5 L” and “10 L”. When variants exist, customers must
                choose one and stock is tracked per variant.
              </p>
            ) : (
              <ul className="space-y-3">
                {variants.map((variant, index) => (
                  <li
                    key={variant.id ?? `new-${index}`}
                    className="rounded-2xl border border-brown/10 p-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-6">
                      {(
                        [
                          ['name', 'Name', 'text', 'sm:col-span-2'],
                          ['sku', 'SKU', 'text', ''],
                          ['price', 'Price ₹ (blank = product price)', 'number', ''],
                          ['salePrice', 'Sale ₹', 'number', ''],
                          ['stock', 'Stock', 'number', ''],
                        ] as const
                      ).map(([key, label, type, span]) => (
                        <label key={key} className={`text-xs font-semibold ${span}`}>
                          {label}
                          <input
                            type={type}
                            min={type === 'number' ? 0 : undefined}
                            step={key === 'stock' ? 1 : type === 'number' ? '0.01' : undefined}
                            value={variant[key]}
                            onChange={(event) =>
                              setVariants((current) =>
                                current.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        [key]:
                                          key === 'sku'
                                            ? event.target.value.toUpperCase()
                                            : event.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                            className="mt-1 h-9 w-full rounded-lg border border-brown/20 px-2 text-sm font-normal"
                          />
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <Checkbox
                        label="Active"
                        checked={variant.isActive}
                        onChange={(event) =>
                          setVariants((current) =>
                            current.map((item, i) =>
                              i === index ? { ...item, isActive: event.target.checked } : item,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="text-sm font-semibold text-danger"
                        onClick={() =>
                          setVariants((current) => current.filter((_, i) => i !== index))
                        }
                      >
                        Remove
                      </button>
                    </div>
                    {variantErr(index) ? (
                      <p className="mt-1 text-sm text-danger">{variantErr(index)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Specifications & delivery">
            <div className="grid gap-4 md:grid-cols-3">
              {SPEC_FIELDS.map(([key, label, type]) => (
                <Field key={key} label={label} error={err(`specs.${key}`)}>
                  {(props) => (
                    <Input
                      {...props}
                      type={type}
                      min={type === 'number' ? 0 : undefined}
                      step={type === 'number' ? 'any' : undefined}
                      value={specs[key]}
                      onChange={(event) =>
                        setSpecs((current) => ({ ...current, [key]: event.target.value }))
                      }
                    />
                  )}
                </Field>
              ))}
              <Field
                label="Shipping & care information"
                error={err('shippingInfo')}
                className="md:col-span-3"
              >
                {(props) => (
                  <Textarea
                    {...props}
                    value={shippingInfo}
                    maxLength={2000}
                    onChange={(event) => setShippingInfo(event.target.value)}
                  />
                )}
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Publishing">
            <div className="space-y-4">
              <Field label="Status" error={err('status')}>
                {(props) => (
                  <Select
                    {...props}
                    value={status}
                    onChange={(event) => setStatus(event.target.value as typeof status)}
                  >
                    <option value="draft">Draft (hidden)</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </Select>
                )}
              </Field>
              <Checkbox
                label="Featured on the homepage"
                checked={isFeatured}
                onChange={(event) => setIsFeatured(event.target.checked)}
              />
              <Checkbox
                label="Bestseller badge"
                checked={isBestseller}
                onChange={(event) => setIsBestseller(event.target.checked)}
              />
              <Field label="Tags" hint="Comma separated, helps search (e.g. summer, water).">
                {(props) => (
                  <Input
                    {...props}
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                  />
                )}
              </Field>
              {!readOnly ? (
                <Button type="submit" className="w-full" loading={busy}>
                  {product ? 'Save changes' : 'Create product'}
                </Button>
              ) : null}
              {product?.status === 'published' ? (
                <Link
                  href={`/products/${product.slug}`}
                  target="_blank"
                  className="block text-center text-sm font-semibold text-terracotta-deep"
                >
                  View on store ↗
                </Link>
              ) : null}
            </div>
          </Card>
          <Card title="Search engines">
            <div className="space-y-4">
              <Field
                label="SEO title"
                error={err('seo.title')}
                hint={`${seoTitle.length}/70 · defaults to the product name`}
              >
                {(props) => (
                  <Input
                    {...props}
                    value={seoTitle}
                    maxLength={70}
                    onChange={(event) => setSeoTitle(event.target.value)}
                  />
                )}
              </Field>
              <Field
                label="SEO description"
                error={err('seo.description')}
                hint={`${seoDescription.length}/170 · defaults to the short description`}
              >
                {(props) => (
                  <Textarea
                    {...props}
                    value={seoDescription}
                    maxLength={170}
                    className="min-h-24"
                    onChange={(event) => setSeoDescription(event.target.value)}
                  />
                )}
              </Field>
            </div>
          </Card>
        </div>
      </fieldset>
      <ImageUploadDialog
        open={editIndex !== null}
        onClose={() => setEditIndex(null)}
        source={
          editIndex !== null && images[editIndex]
            ? {
                id: images[editIndex].assetId,
                alt: images[editIndex].alt,
                url: images[editIndex].variants.at(-1)!.url,
              }
            : undefined
        }
        onUploaded={(asset) => {
          // The edited copy takes the old image's place; the old image stays in the library.
          setImages((current) =>
            current.map((image, i) =>
              i === editIndex
                ? {
                    assetId: asset.id,
                    alt: asset.alt,
                    width: asset.width ?? 0,
                    height: asset.height ?? 0,
                    placeholder: asset.placeholder,
                    variants: asset.variants.map(({ name, url, width, height }) => ({
                      name,
                      url,
                      width,
                      height,
                    })),
                  }
                : image,
            ),
          );
          setEditIndex(null);
        }}
      />
      <MediaPicker
        open={picker}
        onClose={() => {
          setPicker(false);
          setSwapIndex(null);
        }}
        onPick={(asset) => {
          const picked = {
            assetId: asset.id,
            alt: asset.alt,
            width: asset.width ?? 0,
            height: asset.height ?? 0,
            placeholder: asset.placeholder,
            variants: asset.variants.map(({ name, url, width, height }) => ({
              name,
              url,
              width,
              height,
            })),
          };
          // Replace swaps just this product's slot; other products using the old image are unchanged.
          setImages((current) =>
            swapIndex !== null
              ? current.map((image, i) => (i === swapIndex ? picked : image))
              : current.some((image) => image.assetId === asset.id)
                ? current
                : [...current, picked],
          );
          setSwapIndex(null);
        }}
      />
    </form>
  );
}
