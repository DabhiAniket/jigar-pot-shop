import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ORDER_STATUS_LABELS, type PublicOrderDTO } from '@jmh/shared';
import { CopyButton } from '@/components/store/copy-button';
import { OrderDetails } from '@/components/store/order-details';
import { WhatsAppIcon } from '@/components/store/site-footer';
import { buttonClasses, ButtonLink } from '@/components/ui/button';
import { privateGet } from '@/lib/api/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Order confirmation',
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrderConfirmationPage({ params, searchParams }: Props) {
  const { orderNumber } = await params;
  const token = (await searchParams).token;
  if (
    typeof token !== 'string' ||
    !/^[A-Za-z0-9_-]{10,64}$/.test(token) ||
    !/^[A-Z0-9-]{10,20}$/i.test(orderNumber)
  )
    notFound();
  const response = await privateGet<{ data: PublicOrderDTO }>(
    `/orders/${encodeURIComponent(orderNumber)}?token=${encodeURIComponent(token)}`,
  );
  if (!response) notFound();
  const order = response.data;
  const viaWhatsapp = order.channel === 'whatsapp';

  return (
    <div className="container-page max-w-5xl pt-10 pb-10 md:pt-16">
      <div className="rounded-[2rem] border border-gold/40 bg-cream-deep/60 p-6 text-center md:p-10">
        <p className="eyebrow">Order received</p>
        <h1 className="mt-3 text-4xl font-medium md:text-5xl">
          Thank you, {order.customerName.split(' ')[0]}!
        </h1>
        <p className="mt-4 text-lg text-brown-muted">
          Your order has been saved. Please keep your order number.
        </p>
        <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3 rounded-full bg-cream px-5 py-3">
          <span className="text-sm text-brown-muted">Order number</span>
          <span className="font-mono text-xl font-bold tracking-wider" data-testid="order-number">
            {order.orderNumber}
          </span>
          <CopyButton value={order.orderNumber} />
        </div>
        <p className="mt-4 text-sm text-brown-muted">
          Current status: {ORDER_STATUS_LABELS[order.status]}
        </p>

        {order.whatsappUrl ? (
          <div className="mx-auto mt-8 max-w-xl">
            <a
              href={order.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses(
                viaWhatsapp ? 'whatsapp' : 'secondary',
                'lg',
                'w-full sm:w-auto',
              )}
              data-testid="whatsapp-link"
            >
              <WhatsAppIcon className="size-5" />
              {viaWhatsapp ? 'Continue to WhatsApp' : 'Message us on WhatsApp'}
            </a>
            <p className="mt-3 text-sm leading-relaxed text-brown-muted">
              {viaWhatsapp
                ? 'WhatsApp will open with your order details already written. Review the message and tap send — the shop confirms availability and delivery there. If WhatsApp does not open, your order is still saved under the number above.'
                : 'The shop will contact you to confirm availability and delivery. You can also message us on WhatsApp with your order number.'}
            </p>
          </div>
        ) : (
          <p className="mt-6 text-brown-muted">
            The shop will contact you on your mobile number to confirm availability and delivery.
          </p>
        )}
      </div>

      <div className="mt-10">
        <OrderDetails order={order} />
      </div>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/shop" variant="secondary">
          Continue shopping
        </ButtonLink>
        <ButtonLink href="/track-order" variant="ghost">
          Track this order later
        </ButtonLink>
      </div>
    </div>
  );
}
