'use client';

import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';

/**
 * A plain GET form (works without JavaScript). With JavaScript, changing a select or checkbox
 * marked `data-autosubmit` applies the filters immediately via client-side navigation, and empty
 * fields are dropped so URLs stay clean.
 */
export function AutoSubmitForm({
  action,
  children,
  ...props
}: ComponentProps<'form'> & { action: string }) {
  const router = useRouter();

  const navigate = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (
        typeof value === 'string' &&
        value.trim() !== '' &&
        !(key === 'sort' && value === 'featured')
      ) {
        params.set(key, value.trim());
      }
    }
    const query = params.toString();
    router.push(query ? `${action}?${query}` : action, { scroll: false });
  };

  return (
    <form
      {...props}
      action={action}
      method="get"
      role="search"
      onChange={(event) => {
        const target = event.target as HTMLElement;
        if (target.hasAttribute('data-autosubmit')) navigate(event.currentTarget);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        navigate(event.currentTarget);
      }}
    >
      {children}
    </form>
  );
}
