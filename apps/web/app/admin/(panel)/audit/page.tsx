import type { Metadata } from 'next';
import type { AuditEventDTO, Paginated } from '@jmh/shared';
import { FilterBar, filterInput, NoAccess, PageHeader, TableWrap } from '@/components/admin/ui';
import { EmptyState, Pagination } from '@/components/ui/misc';
import { adminGetOrNull } from '@/lib/api/server';
import { formatDateTime, param, toQuery } from '@/lib/utils';

export const metadata: Metadata = { title: 'Audit log' };
export const dynamic = 'force-dynamic';

const ENTITY_TYPES = [
  'admin_user',
  'admin_session',
  'product',
  'category',
  'media',
  'order',
  'promotion',
  'settings',
  'content',
];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const query = {
    action: param(raw.action),
    entityType: param(raw.entityType),
    page: param(raw.page),
  };
  const events = await adminGetOrNull<Paginated<AuditEventDTO>>(`/audit${toQuery(query)}`);
  if (!events) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Sensitive admin actions with who, when and from where."
      />
      <FilterBar action="/admin/audit">
        <input
          name="action"
          defaultValue={query.action}
          placeholder="Action, e.g. order.status_change"
          aria-label="Action"
          className={`${filterInput} w-64`}
        />
        <select
          name="entityType"
          defaultValue={query.entityType ?? ''}
          aria-label="Entity type"
          className={filterInput}
        >
          <option value="">Any type</option>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.replace('_', ' ')}
            </option>
          ))}
        </select>
      </FilterBar>
      {events.data.length ? (
        <TableWrap>
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Details</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {events.data.map((event) => (
              <tr key={event.id}>
                <td className="text-xs whitespace-nowrap text-brown-muted">
                  {formatDateTime(event.createdAt)}
                </td>
                <td>
                  {event.actorName ?? '—'}
                  <div className="text-xs text-brown-muted">{event.actorEmail}</div>
                </td>
                <td className="font-mono text-xs">{event.action}</td>
                <td>{event.summary}</td>
                <td className="font-mono text-xs text-brown-muted">{event.ip ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <EmptyState title="No events found" />
      )}
      <div className="mt-6">
        <Pagination
          page={events.meta.page}
          totalPages={events.meta.totalPages}
          href={(page) => `/admin/audit${toQuery({ ...query, page })}`}
        />
      </div>
    </>
  );
}
