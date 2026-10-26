'use client';

import { useState } from 'react';
import type { AdminCategory, ImageDTO } from '@jmh/shared';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Checkbox, Field, FormError, Input, Textarea } from '@/components/ui/form';
import { Badge, EmptyState } from '@/components/ui/misc';
import { useAdmin, useMutation } from './admin-context';
import { ImageUploadDialog } from './image-uploader';
import { MediaPicker } from './media-picker';
import { TableWrap } from './ui';

interface Draft {
  id: string | null;
  name: string;
  nameGu: string;
  slug: string;
  description: string;
  image: ImageDTO | null;
  sortOrder: string;
  isActive: boolean;
  showOnHome: boolean;
  seoTitle: string;
  seoDescription: string;
}

const emptyDraft = (sortOrder: number): Draft => ({
  id: null,
  name: '',
  nameGu: '',
  slug: '',
  description: '',
  image: null,
  sortOrder: String(sortOrder),
  isActive: true,
  showOnHome: true,
  seoTitle: '',
  seoDescription: '',
});

export function CategoryManager({ categories }: { categories: AdminCategory[] }) {
  const { can } = useAdmin();
  const save = useMutation();
  const remove = useMutation();
  const reorder = useMutation();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picker, setPicker] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);
  const writable = can('categories:write');

  const edit = (category: AdminCategory) =>
    setDraft({
      id: category.id,
      name: category.name,
      nameGu: category.nameGu ?? '',
      slug: category.slug,
      description: category.description,
      image: category.image,
      sortOrder: String(category.sortOrder),
      isActive: category.isActive,
      showOnHome: category.showOnHome,
      seoTitle: category.seo.title ?? '',
      seoDescription: category.seo.description ?? '',
    });

  const move = (index: number, delta: number) => {
    const ids = categories.map((category) => category.id);
    const [item] = ids.splice(index, 1);
    ids.splice(index + delta, 0, item!);
    void reorder.run('/categories/reorder', { body: { ids }, success: 'Order updated' });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const body = {
      name: draft.name,
      nameGu: draft.nameGu || null,
      slug: draft.slug || undefined,
      description: draft.description,
      image: draft.image ? { assetId: draft.image.assetId, alt: draft.image.alt } : null,
      sortOrder: Number(draft.sortOrder || 0),
      isActive: draft.isActive,
      showOnHome: draft.showOnHome,
      seo: { title: draft.seoTitle || null, description: draft.seoDescription || null },
    };
    const result = draft.id
      ? await save.run(`/categories/${draft.id}`, {
          method: 'PUT',
          body,
          success: 'Category saved',
        })
      : await save.run('/categories', { body, success: 'Category created' });
    if (result) setDraft(null);
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  const err = (path: string) => save.fieldErrors[path];

  return (
    <>
      {writable ? (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setDraft(emptyDraft((categories.length + 1) * 10))}>
            Add category
          </Button>
        </div>
      ) : null}
      {categories.length === 0 ? (
        <EmptyState title="No categories yet">
          Create categories such as “Clay Matkas” or “Planters” to organise the shop.
        </EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Category</th>
              <th>Status</th>
              <th className="text-right">Products</th>
              {writable ? <th className="text-right">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {categories.map((category, index) => (
              <tr key={category.id}>
                <td>
                  <div className="flex items-center gap-3">
                    {category.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- pipeline thumbnail
                      <img
                        src={category.image.variants[0]?.url}
                        alt=""
                        width={48}
                        height={48}
                        className="size-12 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="flex size-12 items-center justify-center rounded-xl bg-cream-deep text-xs text-brown-muted">
                        —
                      </span>
                    )}
                    <div>
                      <p className="font-semibold">{category.name}</p>
                      <p className="text-xs text-brown-muted">
                        /collections/{category.slug}
                        {category.nameGu ? <span lang="gu"> · {category.nameGu}</span> : null}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="space-x-1">
                  <Badge tone={category.isActive ? 'sage' : 'neutral'}>
                    {category.isActive ? 'Active' : 'Hidden'}
                  </Badge>
                  {category.showOnHome ? <Badge tone="gold">Homepage</Badge> : null}
                </td>
                <td className="text-right">{category.productCount}</td>
                {writable ? (
                  <td className="text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="mr-2 px-1 disabled:opacity-30"
                      onClick={() => move(index, -1)}
                      disabled={index === 0 || reorder.busy}
                      aria-label={`Move ${category.name} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="mr-3 px-1 disabled:opacity-30"
                      onClick={() => move(index, 1)}
                      disabled={index === categories.length - 1 || reorder.busy}
                      aria-label={`Move ${category.name} down`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="mr-3 font-semibold text-terracotta-deep"
                      onClick={() => edit(category)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="font-semibold text-danger"
                      onClick={() => setDeleting(category)}
                    >
                      Delete
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <Dialog
        open={Boolean(draft) && !picker}
        onClose={() => setDraft(null)}
        busy={save.busy}
        size="lg"
        title={draft?.id ? 'Edit category' : 'New category'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)} disabled={save.busy}>
              Cancel
            </Button>
            <Button type="submit" form="category-form" loading={save.busy}>
              Save
            </Button>
          </>
        }
      >
        {draft ? (
          <form
            id="category-form"
            onSubmit={submit}
            className="grid gap-4 sm:grid-cols-2"
            noValidate
          >
            <div className="sm:col-span-2">
              <FormError message={Object.keys(save.fieldErrors).length ? null : save.error} />
            </div>
            <Field label="Name" required error={err('name')}>
              {(props) => (
                <Input
                  {...props}
                  value={draft.name}
                  maxLength={80}
                  onChange={(e) => set('name', e.target.value)}
                />
              )}
            </Field>
            <Field label="Name in Gujarati" error={err('nameGu')}>
              {(props) => (
                <Input
                  {...props}
                  lang="gu"
                  value={draft.nameGu}
                  maxLength={80}
                  onChange={(e) => set('nameGu', e.target.value)}
                />
              )}
            </Field>
            <Field
              label="URL slug"
              error={err('slug')}
              hint="Leave empty to generate from the name."
            >
              {(props) => (
                <Input
                  {...props}
                  value={draft.slug}
                  maxLength={80}
                  onChange={(e) => set('slug', e.target.value.toLowerCase())}
                />
              )}
            </Field>
            <Field label="Sort order" error={err('sortOrder')}>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={0}
                  value={draft.sortOrder}
                  onChange={(e) => set('sortOrder', e.target.value)}
                />
              )}
            </Field>
            <Field label="Description" error={err('description')} className="sm:col-span-2">
              {(props) => (
                <Textarea
                  {...props}
                  value={draft.description}
                  maxLength={1000}
                  onChange={(e) => set('description', e.target.value)}
                />
              )}
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-semibold">Cover image</p>
              <div className="flex items-center gap-4">
                {draft.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- pipeline variant
                  <img
                    src={draft.image.variants[0]?.url}
                    alt={draft.image.alt}
                    className="size-20 rounded-xl object-cover"
                  />
                ) : null}
                <Button size="sm" variant="secondary" onClick={() => setPicker(true)}>
                  {draft.image ? 'Change image' : 'Choose image'}
                </Button>
                {draft.image ? (
                  <Button size="sm" variant="secondary" onClick={() => setCropping(true)}>
                    Edit crop
                  </Button>
                ) : null}
                {draft.image ? (
                  <button
                    type="button"
                    className="text-sm font-semibold text-danger"
                    onClick={() => set('image', null)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              {err('image.0') || err('image') ? (
                <p className="mt-1 text-sm text-danger">{(err('image.0') ?? err('image'))![0]}</p>
              ) : null}
            </div>
            <Checkbox
              label="Active (visible in the shop)"
              checked={draft.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
            />
            <Checkbox
              label="Show on homepage"
              checked={draft.showOnHome}
              onChange={(e) => set('showOnHome', e.target.checked)}
            />
            <Field label="SEO title" error={err('seo.title')}>
              {(props) => (
                <Input
                  {...props}
                  value={draft.seoTitle}
                  maxLength={70}
                  onChange={(e) => set('seoTitle', e.target.value)}
                />
              )}
            </Field>
            <Field label="SEO description" error={err('seo.description')}>
              {(props) => (
                <Input
                  {...props}
                  value={draft.seoDescription}
                  maxLength={170}
                  onChange={(e) => set('seoDescription', e.target.value)}
                />
              )}
            </Field>
          </form>
        ) : null}
      </Dialog>

      <ImageUploadDialog
        open={cropping && Boolean(draft?.image)}
        onClose={() => setCropping(false)}
        source={
          draft?.image
            ? {
                id: draft.image.assetId,
                alt: draft.image.alt,
                url: draft.image.variants.at(-1)!.url,
              }
            : undefined
        }
        onUploaded={(asset) => {
          // Same image record, new crop: it is already updated everywhere it is used.
          set('image', {
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
          });
          setCropping(false);
        }}
      />

      <MediaPicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(asset) =>
          set('image', {
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
          })
        }
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete “${deleting?.name ?? ''}”?`}
        destructive
        confirmLabel="Delete category"
        message={
          deleting?.productCount
            ? `This category still has ${deleting.productCount} product(s); move them first.`
            : 'This cannot be undone.'
        }
        busy={remove.busy}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          const result = await remove.run(`/categories/${deleting.id}`, {
            method: 'DELETE',
            success: 'Category deleted',
          });
          if (result !== null) setDeleting(null);
        }}
      />
    </>
  );
}
