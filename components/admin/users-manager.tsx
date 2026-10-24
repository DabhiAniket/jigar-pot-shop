'use client';

import { useState } from 'react';
import {
  ADMIN_ROLE_LABELS,
  ADMIN_ROLES,
  checkPasswordStrength,
  type AdminRole,
  type AdminUserDTO,
} from '@jmh/shared';
import { CopyButton } from '@/components/store/copy-button';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Field, FormError, Input, Select, PasswordInput } from '@/components/ui/form';
import { Badge } from '@/components/ui/misc';
import { formatDateTime } from '@/lib/utils';
import { useAdmin, useMutation } from './admin-context';
import { TableWrap } from './ui';

type Pending =
  | { kind: 'toggle'; user: AdminUserDTO }
  | { kind: 'revoke'; user: AdminUserDTO }
  | { kind: 'role'; user: AdminUserDTO; role: AdminRole }
  | { kind: 'reset'; user: AdminUserDTO };

export function UsersManager({ users }: { users: AdminUserDTO[] }) {
  const { me } = useAdmin();
  const create = useMutation();
  const action = useMutation();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: '',
    name: '',
    role: 'order_manager' as AdminRole,
    temporaryPassword: '',
  });
  const [pending, setPending] = useState<Pending | null>(null);
  const [resetLink, setResetLink] = useState<{
    email: string;
    url: string;
    expiresAt: string;
  } | null>(null);
  const problems = form.temporaryPassword
    ? checkPasswordStrength(form.temporaryPassword, { email: form.email, name: form.name })
    : [];

  const confirm = async () => {
    if (!pending) return;
    const { user } = pending;
    if (pending.kind === 'toggle') {
      await action.run(`/users/${user.id}`, {
        method: 'PATCH',
        body: { isActive: !user.isActive },
        success: user.isActive ? 'Account deactivated' : 'Account activated',
      });
    } else if (pending.kind === 'role') {
      await action.run(`/users/${user.id}`, {
        method: 'PATCH',
        body: { role: pending.role },
        success: 'Role changed — the user was signed out',
      });
    } else if (pending.kind === 'revoke') {
      await action.run(`/users/${user.id}/revoke-sessions`, { success: 'Sessions signed out' });
    } else {
      const result = await action.run<{ data: { url: string; expiresAt: string } }>(
        `/users/${user.id}/reset-link`,
        { refresh: false },
      );
      if (result) setResetLink({ email: user.email, ...result.data });
    }
    setPending(null);
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreating(true)}>Add admin user</Button>
      </div>
      <TableWrap>
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last sign-in</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const self = user.id === me.id;
            return (
              <tr key={user.id}>
                <td>
                  <p className="font-semibold">
                    {user.name}{' '}
                    {self ? (
                      <span className="text-xs font-normal text-brown-muted">(you)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-brown-muted">{user.email}</p>
                </td>
                <td>
                  <label className="sr-only" htmlFor={`role-${user.id}`}>
                    Role for {user.email}
                  </label>
                  <select
                    id={`role-${user.id}`}
                    value={user.role}
                    disabled={self}
                    onChange={(event) =>
                      setPending({ kind: 'role', user, role: event.target.value as AdminRole })
                    }
                    className="h-9 rounded-lg border border-brown/20 bg-white px-2 text-sm"
                  >
                    {ADMIN_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ADMIN_ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="space-x-1">
                  <Badge tone={user.isActive ? 'sage' : 'danger'}>
                    {user.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                  {user.mustChangePassword ? <Badge tone="gold">Temp. password</Badge> : null}
                  <span className="block pt-1 text-xs text-brown-muted">
                    {user.activeSessions} active session(s)
                  </span>
                </td>
                <td className="text-xs text-brown-muted">
                  {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}
                </td>
                <td className="space-x-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    className="font-semibold text-terracotta-deep"
                    onClick={() => setPending({ kind: 'reset', user })}
                    disabled={!user.isActive}
                  >
                    Reset link
                  </button>
                  <button
                    type="button"
                    className="font-semibold"
                    onClick={() => setPending({ kind: 'revoke', user })}
                    disabled={user.activeSessions === 0}
                  >
                    Sign out
                  </button>
                  {!self ? (
                    <button
                      type="button"
                      className={`font-semibold ${user.isActive ? 'text-danger' : 'text-[#3f4d35]'}`}
                      onClick={() => setPending({ kind: 'toggle', user })}
                    >
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        busy={create.busy}
        title="Add admin user"
        description="Share the temporary password privately. The person must change it at first sign-in."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={create.busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-user"
              loading={create.busy}
              disabled={problems.length > 0}
            >
              Create account
            </Button>
          </>
        }
      >
        <form
          id="create-user"
          className="space-y-4"
          noValidate
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await create.run('/users', {
              body: form,
              success: 'Admin account created',
            });
            if (result) {
              setCreating(false);
              setForm({ email: '', name: '', role: 'order_manager', temporaryPassword: '' });
            }
          }}
        >
          <FormError message={Object.keys(create.fieldErrors).length ? null : create.error} />
          <Field label="Name" required error={create.fieldErrors.name}>
            {(props) => (
              <Input
                {...props}
                value={form.name}
                maxLength={80}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            )}
          </Field>
          <Field label="Email" required error={create.fieldErrors.email}>
            {(props) => (
              <Input
                {...props}
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            )}
          </Field>
          <Field
            label="Role"
            required
            error={create.fieldErrors.role}
            hint="Product managers cannot see orders or customers; order managers cannot edit the catalogue."
          >
            {(props) => (
              <Select
                {...props}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })}
              >
                {ADMIN_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ADMIN_ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Temporary password" required error={create.fieldErrors.temporaryPassword}>
            {(props) => (
              <PasswordInput
                {...props}
                autoComplete="new-password"
                value={form.temporaryPassword}
                onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })}
              />
            )}
          </Field>
          {form.temporaryPassword ? (
            problems.length ? (
              <ul className="space-y-1 text-sm text-danger">
                {problems.map((problem) => (
                  <li key={problem}>• {problem}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-medium text-[#3f4d35]">Strong password ✓</p>
            )
          ) : null}
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pending)}
        busy={action.busy}
        destructive={pending?.kind === 'toggle' && pending.user.isActive}
        title={
          pending?.kind === 'toggle'
            ? `${pending.user.isActive ? 'Deactivate' : 'Activate'} ${pending.user.email}?`
            : pending?.kind === 'role'
              ? `Change role to ${ADMIN_ROLE_LABELS[pending.role]}?`
              : pending?.kind === 'revoke'
                ? 'Sign out all sessions?'
                : 'Issue a password reset link?'
        }
        message={
          pending?.kind === 'toggle'
            ? pending.user.isActive
              ? 'They are signed out immediately and cannot sign in until reactivated.'
              : 'They will be able to sign in again.'
            : pending?.kind === 'role'
              ? `${pending.user.email} is signed out so the new permissions apply immediately.`
              : pending?.kind === 'revoke'
                ? `Every device signed in as ${pending.user.email} is signed out.`
                : 'A single-use link valid for 30 minutes is created. Any earlier link stops working. Share it privately.'
        }
        onClose={() => setPending(null)}
        onConfirm={() => void confirm()}
      />

      <Dialog
        open={Boolean(resetLink)}
        onClose={() => setResetLink(null)}
        title="Password reset link"
        description={
          resetLink
            ? `For ${resetLink.email} · expires ${formatDateTime(resetLink.expiresAt)}`
            : undefined
        }
      >
        {resetLink ? (
          <div className="space-y-3">
            <p className="text-sm text-brown-muted">
              This link is shown only once. Send it privately (for example over WhatsApp to the
              staff member).
            </p>
            <p className="rounded-xl bg-white p-3 font-mono text-xs break-all">{resetLink.url}</p>
            <CopyButton value={resetLink.url} label="Copy link" />
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
