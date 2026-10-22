import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { POLICY_KEYS, type PolicyDTO, type PolicyKey } from '@jmh/shared';
import { publicGetOrNull } from '@/lib/api/server';
import { formatDate } from '@/lib/utils';

type Props = { params: Promise<{ policy: string }> };

export const revalidate = 300;

async function load(policy: string) {
  if (!(POLICY_KEYS as readonly string[]).includes(policy)) return null;
  const response = await publicGetOrNull<{ data: PolicyDTO }>(`/policies/${policy as PolicyKey}`, {
    revalidate: 300,
    tags: ['settings'],
  });
  return response?.data ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const policy = await load((await params).policy);
  if (!policy) return { title: 'Not found', robots: { index: false } };
  return {
    title: policy.title,
    alternates: { canonical: `/policies/${policy.key}` },
    // An unpublished policy page has no content worth indexing.
    robots: policy.body ? undefined : { index: false },
  };
}

export default async function PolicyPage({ params }: Props) {
  const policy = await load((await params).policy);
  if (!policy) notFound();
  return (
    <article className="container-page max-w-3xl pt-10 pb-10 md:pt-16">
      <h1 className="text-4xl font-medium md:text-5xl">{policy.title}</h1>
      {policy.updatedAt && policy.body ? (
        <p className="mt-3 text-sm text-brown-muted">Last updated {formatDate(policy.updatedAt)}</p>
      ) : null}
      <div className="gold-rule my-8" />
      {policy.body ? (
        <div className="prose-craft">
          {policy.body.split(/\n{2,}/).map((block, index) =>
            /^#{1,3}\s/.test(block) ? (
              <h2 key={index}>{block.replace(/^#{1,3}\s/, '')}</h2>
            ) : (
              <p key={index} className="whitespace-pre-line">
                {block}
              </p>
            ),
          )}
        </div>
      ) : (
        <p className="text-lg text-brown-muted">
          This policy has not been published yet. Please contact the store for details.
        </p>
      )}
    </article>
  );
}
