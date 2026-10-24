import Link from 'next/link';
import {
  buildWhatsAppUrl,
  formatIndianMobile,
  WEEKDAYS,
  type CategoryDTO,
  type PublicStoreSettings,
} from '@jmh/shared';

const POLICY_LINKS = [
  { key: 'shipping', href: '/policies/shipping', label: 'Shipping & delivery' },
  { key: 'returns', href: '/policies/returns', label: 'Returns & refunds' },
  { key: 'privacy', href: '/policies/privacy', label: 'Privacy policy' },
  { key: 'terms', href: '/policies/terms', label: 'Terms & conditions' },
] as const;

const DAY_LABELS: Record<(typeof WEEKDAYS)[number], string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

/** Shows only business details that have actually been configured in Admin → Settings. */
export function SiteFooter({
  settings,
  categories,
}: {
  settings: PublicStoreSettings | null;
  categories: CategoryDTO[];
}) {
  const storeName = settings?.storeName ?? 'Jigar Matka House';
  const address = settings?.address;
  const addressLines = address
    ? [
        address.line1,
        address.line2,
        [address.city, address.state, address.pincode].filter(Boolean).join(', '),
      ].filter(Boolean)
    : [];
  const whatsapp = settings?.whatsappNumber
    ? buildWhatsAppUrl(settings.whatsappNumber, `Hello ${storeName}!`)
    : null;
  const social = settings
    ? (
        [
          ['Instagram', settings.social.instagram],
          ['Facebook', settings.social.facebook],
          ['YouTube', settings.social.youtube],
          ['X', settings.social.x],
        ] as const
      ).filter(([, url]) => Boolean(url))
    : [];
  const openDays = settings?.openingHours.filter((entry) => entry.isOpen) ?? [];
  const hasContact = Boolean(
    settings?.phone || whatsapp || settings?.email || addressLines.length || openDays.length,
  );
  const policies = POLICY_LINKS.filter((policy) => settings?.policiesAvailable[policy.key]);

  return (
    <footer className="relative mt-24 overflow-hidden bg-brown text-cream/90">
      <div className="h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-70" />
      <div className="container-page grid gap-12 py-16 md:grid-cols-12 md:py-20">
        <div className="md:col-span-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
          <img
            src="/brand/v1/emblem-256.webp"
            width={256}
            height={256}
            alt={storeName}
            className="size-32 md:size-36"
            loading="lazy"
          />
          {settings?.tagline ? (
            <p className="mt-5 max-w-xs text-[0.9375rem] leading-relaxed text-cream/75">
              {settings.tagline}
            </p>
          ) : null}
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-gold/50 px-5 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-gold hover:text-brown"
            >
              <WhatsAppIcon className="size-4.5" /> Chat on WhatsApp
            </a>
          ) : null}
        </div>

        <nav aria-label="Shop" className="md:col-span-2">
          <h2 className="mb-4 font-sans text-xs font-bold tracking-[0.18em] text-gold uppercase">
            Shop
          </h2>
          <ul className="space-y-2.5 text-[0.9375rem]">
            <li>
              <Link href="/shop" className="hover:text-gold">
                All products
              </Link>
            </li>
            {categories.slice(0, 8).map((category) => (
              <li key={category.id}>
                <Link href={`/collections/${category.slug}`} className="hover:text-gold">
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Help" className="md:col-span-2">
          <h2 className="mb-4 font-sans text-xs font-bold tracking-[0.18em] text-gold uppercase">
            Help
          </h2>
          <ul className="space-y-2.5 text-[0.9375rem]">
            <li>
              <Link href="/track-order" className="hover:text-gold">
                Track your order
              </Link>
            </li>
            <li>
              <Link href="/cart" className="hover:text-gold">
                Your cart
              </Link>
            </li>
            {policies.map((policy) => (
              <li key={policy.key}>
                <Link href={policy.href} className="hover:text-gold">
                  {policy.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {hasContact ? (
          <div className="md:col-span-4">
            <h2 className="mb-4 font-sans text-xs font-bold tracking-[0.18em] text-gold uppercase">
              Visit & contact
            </h2>
            <address className="space-y-3 text-[0.9375rem] not-italic leading-relaxed">
              {addressLines.length ? (
                <p>
                  {addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                  {address?.mapUrl ? (
                    <a
                      href={address.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-gold underline-offset-4 hover:underline"
                    >
                      Get directions
                    </a>
                  ) : null}
                </p>
              ) : null}
              {settings?.phone ? (
                <p>
                  Phone:{' '}
                  <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="hover:text-gold">
                    {/^\d{10}$/.test(settings.phone)
                      ? formatIndianMobile(settings.phone)
                      : settings.phone}
                  </a>
                </p>
              ) : null}
              {settings?.email ? (
                <p>
                  Email:{' '}
                  <a href={`mailto:${settings.email}`} className="hover:text-gold">
                    {settings.email}
                  </a>
                </p>
              ) : null}
              {openDays.length ? (
                <div>
                  <p className="mb-1 text-cream/70">Opening hours</p>
                  <ul className="grid grid-cols-[auto_1fr] gap-x-4 text-sm">
                    {openDays.map((entry) => (
                      <li key={entry.day} className="contents">
                        <span>{DAY_LABELS[entry.day]}</span>
                        <span>
                          {entry.opens} – {entry.closes}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </address>
            {social.length ? (
              <ul className="mt-6 flex flex-wrap gap-3">
                {social.map(([label, url]) => (
                  <li key={label}>
                    <a
                      href={url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-cream/20 px-4 py-2 text-sm hover:border-gold hover:text-gold"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="border-t border-cream/10">
        <div className="container-page flex flex-col gap-2 py-6 text-sm text-cream/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {settings?.legalName ?? storeName}
          </p>
          <p lang="gu">માટીની ખુશ્બૂ, પરંપરાનો સ્પર્શ</p>
        </div>
      </div>
    </footer>
  );
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" />
    </svg>
  );
}
