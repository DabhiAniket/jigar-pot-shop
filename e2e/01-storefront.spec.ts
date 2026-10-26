import { expect, test, type Page } from '@playwright/test';

/** Shared with 02-admin.spec.ts through the order list (the admin test updates this order). */
const CUSTOMER = { name: 'Asha Mehta', phone: '98250 12345' };
const PASSWORD = 'Terracotta-Kiln-48';

async function register(page: Page, name: string, email: string, phone: string) {
  await page.goto('/account/register');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mobile number').fill(phone);
  await page.locator('input[name=password]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test.describe('storefront', () => {
  test('homepage renders the hero, collections and products', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'માટીની ખુશ્બૂ, પરંપરાનો સ્પર્શ',
    );
    await expect(page.getByRole('link', { name: 'Shop Products' })).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();
    await page.getByRole('heading', { name: 'Bestsellers' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: 'Bestsellers' })).toBeVisible();
  });

  test('search and filter the catalogue', async ({ page }) => {
    await page.goto('/shop');
    await page.getByRole('searchbox', { name: 'Search products' }).last().fill('surahi');
    await page.getByRole('searchbox', { name: 'Search products' }).last().press('Enter');
    await expect(page).toHaveURL(/q=surahi/);
    await expect(page.getByRole('heading', { name: 'Clay Surahi' })).toBeVisible();

    await page.goto('/shop');
    await page.getByLabel('Category').selectOption('planters');
    await expect(page).toHaveURL(/category=planters/);
    const names = await page.locator('article h3').allTextContents();
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((name) => /planter/i.test(name))).toBe(true);
  });

  test('product page has structured data and breadcrumbs', async ({ page }) => {
    await page.goto('/products/clay-surahi');
    await expect(page.getByRole('heading', { level: 1, name: 'Clay Surahi' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText(
      'Earthen Water Pots',
    );
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    const product = jsonLd
      .map((text) => JSON.parse(text))
      .find((data) => data['@type'] === 'Product');
    expect(product.offers.priceCurrency).toBe('INR');
    expect(product.offers.price).toBe('449.00');
    expect(product).not.toHaveProperty('aggregateRating');
    await expect(page).toHaveTitle(/Clay Surahi/);
  });

  test('sign in, check out with WhatsApp and see the saved order in My orders', async ({
    page,
    browser,
  }) => {
    await register(page, CUSTOMER.name, 'asha.e2e@example.com', CUSTOMER.phone);
    await page.goto('/products/clay-surahi');
    await page.getByRole('button', { name: 'Increase quantity' }).click();
    await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
    await expect(page.getByRole('link', { name: /Cart, 2 items/ })).toBeVisible();

    await page.goto('/cart');
    await expect(page.getByText('Summary')).toBeVisible();
    await expect(page.getByRole('main').getByText('₹898').first()).toBeVisible();
    await page.getByRole('link', { name: 'Proceed to checkout' }).click();

    await expect(page).toHaveURL(/\/checkout/);
    // Name and phone come from the account.
    await expect(page.getByLabel('Full name')).toHaveValue(CUSTOMER.name);
    await page.getByText('Store pickup', { exact: true }).click();
    await page.getByRole('button', { name: /Place order & continue to WhatsApp/ }).click();

    await expect(page).toHaveURL(/\/account\/orders\/JMH-\d{6}-[0-9A-Z]{5}\?placed=1/);
    const orderNumber = (await page.getByTestId('order-number').textContent())!.trim();
    const whatsapp = await page
      .getByRole('link', { name: /Send your order on WhatsApp/ })
      .getAttribute('href');
    const url = new URL(whatsapp!);
    expect(`${url.origin}${url.pathname}`).toBe('https://wa.me/919000000001');
    const text = url.searchParams.get('text')!;
    expect(text).toContain(`Order ID: ${orderNumber}`);
    expect(text).toContain('Clay Surahi × 2');
    expect(text).toContain('Total: ₹898');

    // It is listed under My orders, and the cart (also saved on the account) is empty.
    await page.goto('/account/orders');
    await expect(page.getByRole('link', { name: new RegExp(orderNumber) })).toBeVisible();
    await expect(
      page.getByRole('link', { name: new RegExp(orderNumber) }).getByText('Pending'),
    ).toBeVisible();

    // A different customer who knows the exact order number cannot see it.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await register(otherPage, 'Bhavin Joshi', 'bhavin.e2e@example.com', '98250 54321');
    await otherPage.goto(`/account/orders/${orderNumber}`);
    await expect(otherPage.getByRole('heading', { name: 'Order not found' })).toBeVisible();
    await expect(otherPage.getByText(CUSTOMER.name)).toHaveCount(0);
    await otherPage.goto('/account/orders');
    await expect(otherPage.getByText('No orders yet')).toBeVisible();
    await other.close();
  });

  test('checkout asks guests to sign in and keeps the cart', async ({ page }) => {
    await page.goto('/products/clay-surahi');
    await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Sign in to place your order' })).toBeVisible();
  });

  test('unknown pages return the custom 404', async ({ page }) => {
    const response = await page.goto('/products/this-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('This pot seems to have rolled away')).toBeVisible();
  });

  test('robots and sitemap are served', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /admin');
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/products/clay-surahi');
  });

  test('mobile layout has no horizontal overflow and an accessible menu @mobile', async ({
    page,
  }) => {
    for (const path of ['/', '/shop', '/products/classic-clay-matka', '/cart']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, path).toBe(false);
    }
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
  });

  test('account pages fit a phone screen @mobile', async ({ page }) => {
    await register(page, 'Mobile Shopper', `mobile.${Date.now()}@example.com`, '98250 77777');
    for (const path of ['/account', '/account/orders', '/checkout']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
    await expect(page.getByRole('heading', { name: 'Nothing to check out yet' })).toBeVisible();
  });
});
