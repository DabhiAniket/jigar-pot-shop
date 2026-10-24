'use client';

import type { AdminSessionDTO } from '@jmh/shared';
import { Badge } from '@/components/ui/misc';
import { formatDateTime } from '@/lib/utils';
import { useMutation } from './admin-context';

export function SessionsList({ sessions }: { sessions: AdminSessionDTO[] }) {
  const { run, busy } = useMutation();
  if (sessions.length === 0) return <p className="text-sm text-brown-muted">No active sessions.</p>;
  return (
    <ul className="divide-y divide-brown/10">
      {sessions.map((session) => (
        <li
          key={session.id}
          className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
        >
          <div className="min-w-0">
            <p className="truncate font-semibold">{session.userAgent ?? 'Unknown device'}</p>
            <p className="text-xs text-brown-muted">
              {session.ip ?? 'Unknown IP'} · signed in {formatDateTime(session.createdAt)} · last
              active {formatDateTime(session.lastSeenAt)}
            </p>
          </div>
          {session.current ? (
            <Badge tone="sage">This device</Badge>
          ) : (
            <button
              type="button"
              disabled={busy}
              className="font-semibold text-danger disabled:opacity-50"
              onClick={() =>
                void run(`/auth/sessions/${session.id}`, {
                  method: 'DELETE',
                  success: 'Session signed out',
                })
              }
            >
              Sign out
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
