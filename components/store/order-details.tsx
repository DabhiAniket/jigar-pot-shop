import {
  FULFILLMENT_LABELS,
  formatINR,
  ORDER_STATUS_LABELS,
  type PublicOrderDTO,
} from '@jmh/shared';
import { formatDateTime } from '@/lib/utils';
import { TotalsTable } from './order-summary';

export function OrderDetails({ order }: { order: PublicOrderDTO }) {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section aria-labelledby="items-title" className="rounded-[1.75rem] bg-cream-deep p-6">
        <h2 id="items-title" className="text-xl font-medium">
          Items
        </h2>
        <ul className="mt-4 divide-y divide-brown/10">
          {order.items.map((item) => (
            <li
              key={`${item.productId}:${item.variantId ?? ''}`}
              className="flex items-center gap-3 py-3"
            >
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- pipeline thumbnail
                <img
                  src={item.image}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 rounded-xl object-cover"
                />
              ) : null}
              <div className="flex-1 text-[0.9375rem]">
                <p className="font-semibold">
                  {item.name}
                  {item.variantName ? (
                    <span className="font-normal text-brown-muted"> ({item.variantName})</span>
                  ) : null}
                </p>
                <p className="text-sm text-brown-muted">
                  {item.quantity} × {formatINR(item.unitPrice)}
                </p>
              </div>
              <p className="font-semibold">{formatINR(item.lineSubtotal)}</p>
            </li>
          ))}
        </ul>
        <TotalsTable
          className="mt-4 border-t border-brown/10 pt-4"
          subtotal={order.pricing.subtotal}
          discountTotal={order.pricing.discountTotal}
          deliveryCharge={order.pricing.deliveryCharge}
          total={order.pricing.total}
          fulfillment={order.fulfillment}
          promotionName={order.pricing.appliedPromotion?.name}
        />
      </section>
      <section aria-labelledby="fulfil-title" className="space-y-6">
        <div>
          <h2 id="fulfil-title" className="text-xl font-medium">
            {FULFILLMENT_LABELS[order.fulfillment]}
          </h2>
          {order.address ? (
            <address className="mt-2 not-italic leading-relaxed text-brown-muted">
              {order.customerName}
              <br />
              {order.address.line1}
              {order.address.line2 ? (
                <>
                  <br />
                  {order.address.line2}
                </>
              ) : null}
              {order.address.landmark ? (
                <>
                  <br />
                  Near {order.address.landmark}
                </>
              ) : null}
              <br />
              {order.address.city}, {order.address.state} {order.address.pincode}
            </address>
          ) : (
            <p className="mt-2 text-brown-muted">
              You will collect this order from the shop. We will confirm when it is ready.
            </p>
          )}
          <p className="mt-2 text-sm text-brown-muted">Contact number: {order.phoneMasked}</p>
        </div>
        <div>
          <h2 className="text-xl font-medium">Status</h2>
          <ol className="mt-3 space-y-3 border-l border-gold/50 pl-5">
            {order.history.map((event) => (
              <li key={`${event.status}-${event.at}`} className="relative">
                <span
                  className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-terracotta"
                  aria-hidden="true"
                />
                <p className="font-semibold">{ORDER_STATUS_LABELS[event.status]}</p>
                <p className="text-sm text-brown-muted">{formatDateTime(event.at)}</p>
              </li>
            ))}
          </ol>
        </div>
        {order.notes ? (
          <div>
            <h2 className="text-xl font-medium">Your notes</h2>
            <p className="mt-2 text-brown-muted">{order.notes}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
