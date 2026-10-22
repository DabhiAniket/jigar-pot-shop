import type { Metadata } from 'next';
import type { MediaAssetDTO, Paginated } from '@jmh/shared';
import { MediaLibrary } from '@/components/admin/media-library';
import { FilterBar, filterInput, PageHeader } from '@/components/admin/ui';
import { Pagination } from '@/components/ui/misc';
import { adminGet } from '@/lib/api/server';
import { param, toQuery } from '@/lib/utils';

export const metadata: Metadata = { title: 'Image library' };
export const dynamic = 'force-dynamic';

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const query = {
    q: param(raw.q),
    status: param(raw.status),
    unused: param(raw.unused),
    page: param(raw.page),
  };
  const media = await adminGet<Paginated<MediaAssetDTO>>(`/media${toQuery(query)}`);
  return (
    <>
      <PageHeader
        title="Image library"
        description={`${media.meta.total} images · originals are converted to WebP sizes for cards, pages and zoom.`}
      />
      <FilterBar action="/admin/media">
        <input
          name="q"
          defaultValue={query.q}
          placeholder="File name or alt text"
          aria-label="Search images"
          className={`${filterInput} w-56`}
        />
        <select
          name="status"
          defaultValue={query.status ?? ''}
          aria-label="Status"
          className={filterInput}
        >
          <option value="">Any status</option>
          <option value="ready">Ready</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
        </select>
        <label className="flex h-10 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="unused"
            value="true"
            defaultChecked={query.unused === 'true'}
            className="size-4 accent-terracotta"
          />
          Unused only
        </label>
      </FilterBar>
      <MediaLibrary assets={media.data} />
      <div className="mt-6">
        <Pagination
          page={media.meta.page}
          totalPages={media.meta.totalPages}
          href={(page) => `/admin/media${toQuery({ ...query, page })}`}
        />
      </div>
    </>
  );
}
