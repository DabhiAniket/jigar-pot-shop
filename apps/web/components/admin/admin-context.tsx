'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { hasPermission, type AdminMe, type Permission } from '@jmh/shared';
import { api, ClientApiError, setCsrfToken } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

interface AdminContextValue {
  me: AdminMe;
  can: (permission: Permission) => boolean;
  toast: (message: string, tone?: Toast['tone']) => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ me, children }: { me: AdminMe; children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Set synchronously so the very first mutation already carries the CSRF token.
  setCsrfToken(me.csrfToken);
  // Re-set on mount too: Strict Mode's simulated unmount would otherwise leave it cleared.
  useEffect(() => {
    setCsrfToken(me.csrfToken);
    return () => setCsrfToken(null);
  }, [me.csrfToken]);

  const toast = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4500);
  }, []);

  return (
    <AdminContext.Provider
      value={{ me, can: (permission) => hasPermission(me.role, permission), toast }}
    >
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            role={item.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto rounded-2xl px-4 py-3 text-sm font-medium shadow-lift',
              item.tone === 'error' ? 'bg-danger text-white' : 'bg-brown text-cream',
            )}
          >
            {item.message}
          </div>
        ))}
      </div>
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error('useAdmin must be used inside AdminProvider');
  return value;
}

/**
 * Runs an admin API mutation with busy state, field errors and a toast, then refreshes the
 * server-rendered page data.
 */
export function useMutation() {
  const router = useRouter();
  const { toast } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(
      path: string,
      options: {
        method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        body?: unknown;
        success?: string;
        refresh?: boolean;
      } = {},
    ): Promise<T | null> => {
      setBusy(true);
      setError(null);
      setFieldErrors({});
      try {
        const result = await api<T>(`/admin${path}`, {
          method: options.method ?? 'POST',
          body: options.body,
        });
        if (options.success) toast(options.success);
        if (options.refresh !== false) router.refresh();
        return result;
      } catch (reason) {
        const message = reason instanceof ClientApiError ? reason.message : 'Something went wrong.';
        if (reason instanceof ClientApiError) setFieldErrors(reason.fields);
        setError(message);
        toast(message, 'error');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [router, toast],
  );

  return { run, busy, error, fieldErrors, setFieldErrors };
}
