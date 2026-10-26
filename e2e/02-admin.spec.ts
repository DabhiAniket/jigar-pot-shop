import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// Credentials of the isolated E2E database only (see scripts/e2e-web.sh).
const EMAIL = 'e2e.owner@example.com';
const TEMPORARY = 'E2e-Temporary-Kiln-2026!';
const FINAL = 'E2e-Fired-Matka-Lid-77';
const IMAGE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures/clay-surahi.jpg',
);

test.describe.configure({ mode: 'serial' });

async function signIn(page: Page, password: string) {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe('admin', () => {
  test('first sign-in forces a password change', async ({ page }) => {
    await signIn(page, TEMPORARY);
    await expect(page).toHaveURL(/\/admin\/change-password/);
    await page.getByRole('textbox', { name: 'Current password', exact: true }).fill(TEMPORARY);
    await page.getByRole('textbox', { name: 'New password', exact: true }).fill(FINAL);
    await page.getByRole('textbox', { name: 'Confirm new password', exact: true }).fill(FINAL);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Total orders')).toBeVisible();
  });

  test('rejects wrong credentials with a generic message', async ({ page }) => {
    await signIn(page, 'Not-The-Password-1');
    await expect(
      page.getByRole('alert').filter({ hasText: 'Incorrect email or password' }),
    ).toBeVisible();
  });

  test('upload, crop and publish a product image that appears on the storefront', async ({
    page,
  }) => {
    await signIn(page, FINAL);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.goto('/admin/products/new');
    await page.getByRole('textbox', { name: 'Product name', exact: true }).fill('E2E Glazed Pot');
    await page.getByRole('spinbutton', { name: 'Price (₹)', exact: true }).fill('555');

    await page.getByRole('button', { name: 'Add image' }).click();
    await page.getByRole('button', { name: 'Upload new image' }).click();
    await page.locator('input[type=file]').setInputFiles(IMAGE);
    await expect(page.getByLabel('Crop area. Use the arrow keys to move the image.')).toBeVisible();
    await page.getByRole('button', { name: '⟳ 90°' }).click();
    await page.getByLabel(/Zoom/).fill('1.4');
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByAltText('Preview of the cropped image')).toBeVisible();
    await page.getByRole('button', { name: 'Upload & process' }).click();
    await expect(page.getByText('Main image')).toBeVisible({ timeout: 60_000 });

    await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('published');
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page).toHaveURL(/\/admin\/products\/[a-f\d]{24}$/);

    const response = await page.goto('/products/e2e-glazed-pot');
    expect(response?.status()).toBe(200);
    const image = page.getByRole('main').locator('img').first();
    await expect(image).toHaveAttribute('src', /\/media\/img\/[a-f\d]{24}\/.+\.webp$/);
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    const srcset = await image.getAttribute('srcset');
    expect(srcset).toMatch(/thumb-240\.webp 240w/);
  });

  test('re-crop an uploaded image without uploading it again', async ({ page }) => {
    await signIn(page, FINAL);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.goto('/admin/products');
    await page.getByRole('link', { name: 'E2E Glazed Pot' }).first().click();
    const imageCard = page.getByRole('listitem').filter({ hasText: 'Main image' });
    const before = await imageCard.locator('img').getAttribute('src');

    await imageCard.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByLabel('Crop area. Use the arrow keys to move the image.')).toBeVisible();
    await expect(page.locator('input[type=file]')).toHaveCount(0); // no new upload needed
    await page.getByRole('radio', { name: /Portrait 4:5/ }).check();
    await page.getByRole('button', { name: 'Preview' }).click();
    const preview = page.getByAltText('Preview of the cropped image');
    await expect(preview).toBeVisible();
    const previewRatio = await preview.evaluate(
      (img: HTMLImageElement) => img.naturalWidth / img.naturalHeight,
    );
    expect(previewRatio).toBeCloseTo(0.8, 1);
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 60_000 });

    // The edited copy replaced the image in the form; the saved file has the previewed shape.
    const after = await imageCard.locator('img').getAttribute('src');
    expect(after).not.toBe(before);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Product saved')).toBeVisible();
    // The storefront page is cached briefly; poll until it serves the re-cropped image.
    await expect
      .poll(
        async () => {
          await page.goto('/products/e2e-glazed-pot');
          const image = page.getByRole('main').locator('img').first();
          return image.evaluate((img: HTMLImageElement) => {
            const largest = img.srcset.split(',').at(-1)!.trim().split(' ')[0]!;
            return fetch(largest)
              .then((response) => response.blob())
              .then((blob) => createImageBitmap(blob))
              .then((bitmap) => Number((bitmap.width / bitmap.height).toFixed(2)));
          });
        },
        { timeout: 30_000 },
      )
      .toBeCloseTo(previewRatio, 1);
  });

  test('update the status of the storefront order', async ({ page }) => {
    await signIn(page, FINAL);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.goto('/admin/orders?q=Asha');
    await page.locator('tbody a').first().click();
    await expect(page.getByText('Pending').first()).toBeVisible();
    await page.getByText('Confirmed', { exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Note for the history (optional)' })
      .fill('Confirmed with customer on WhatsApp');
    await page.getByRole('button', { name: 'Update status' }).click();
    await expect(page.getByText('Confirmed with customer on WhatsApp')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Confirmed');
  });

  test('a customer cancellation request is approved by staff', async ({ page, browser }) => {
    const customer = await browser.newContext();
    const shopper = await customer.newPage();
    await shopper.goto('/account/login');
    await shopper.getByLabel('Email').fill('asha.e2e@example.com');
    await shopper.locator('input[name=password]').fill('Terracotta-Kiln-48');
    await shopper.getByRole('button', { name: 'Sign in' }).click();
    await expect(shopper).toHaveURL(/\/account$/);
    await shopper.goto('/account/orders');
    await shopper.getByRole('link', { name: /JMH-/ }).first().click();
    await shopper.getByRole('button', { name: 'Request cancellation' }).click();
    await shopper.getByLabel('Why do you want to cancel?').fill('Ordered by mistake');
    await shopper.getByRole('button', { name: 'Send request' }).click();
    await expect(shopper.getByText('Waiting for the store')).toBeVisible();
    await expect(shopper.getByRole('button', { name: 'Request cancellation' })).toHaveCount(0);

    await signIn(page, FINAL);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.goto('/admin/orders?cancellationRequest=requested');
    await expect(page.getByText('Cancel requested')).toBeVisible();
    await page.locator('tbody a').first().click();
    await expect(page.getByText('Customer asked to cancel')).toBeVisible();
    await page.getByRole('button', { name: 'Approve and cancel order' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel order' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Cancelled');

    await shopper.reload();
    await expect(shopper.getByText('Cancelled at your request')).toBeVisible();
    await customer.close();
  });

  /** Places a delivery order as a brand-new customer, through the public API (like the browser). */
  async function placeOrderAs(
    request: APIRequestContext,
    baseURL: string,
  ): Promise<{ orderNumber: string; csrf: string }> {
    const headers = { Origin: new URL(baseURL).origin };
    const email = `inline.${Date.now()}@example.com`;
    const registered = await request.post('/api/v1/account/register', {
      headers,
      data: { name: 'Inline Tester', email, phone: '9825055555', password: 'Terracotta-Kiln-48' },
    });
    expect(registered.status()).toBe(201);
    const csrf = (await registered.json()).data.csrfToken as string;
    const products = await (await request.get('/api/v1/products?limit=1')).json();
    const order = await request.post('/api/v1/orders', {
      headers: {
        ...headers,
        'x-csrf-token': csrf,
        'idempotency-key': `inline-${Date.now()}-abcdefgh`,
      },
      data: {
        items: [{ productId: products.data[0].id, quantity: 1 }],
        fulfillment: 'delivery',
        channel: 'website',
        customer: { name: 'Inline Tester', phone: '9825055555' },
        address: {
          line1: '1 Test Road',
          city: 'Rajkot',
          state: 'Gujarat',
          pincode: '360001',
        },
      },
    });
    expect(order.status()).toBe(201);
    return { orderNumber: (await order.json()).data.order.orderNumber, csrf };
  }

  test('update an order from its row in the list, including shipping details', async ({
    page,
    request,
    baseURL,
  }) => {
    const { orderNumber } = await placeOrderAs(request, baseURL!);
    await signIn(page, FINAL);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.goto(`/admin/orders?q=${orderNumber}`);
    const row = page.getByRole('row').filter({ hasText: orderNumber });
    const statusCell = row.getByRole('cell').nth(3);
    await expect(statusCell).toContainText('Pending');

    const dialog = page.getByRole('dialog');
    const move = async (label: string) => {
      await dialog.getByText(label, { exact: true }).click();
      await dialog.getByRole('button', { name: 'Update status' }).click();
    };
    await row.getByRole('button', { name: `Update order ${orderNumber}` }).click();
    await move('Confirmed');
    await expect(page.getByText('Order marked confirmed')).toBeVisible();
    await move('Processing');
    await expect(page.getByText('Order marked processing')).toBeVisible();
    await move('Ready for dispatch / pickup');
    await expect(page.getByText('Order marked ready for dispatch / pickup')).toBeVisible();

    // Shipping details are required before Shipped: the empty form cannot be submitted.
    await dialog.getByText('Shipped', { exact: true }).click();
    await dialog.getByRole('button', { name: 'Update status' }).click();
    const provider = dialog.getByLabel(/Shipping provider/).first();
    expect(await provider.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false);
    await expect(statusCell).not.toContainText('Shipped');
    await dialog
      .getByLabel(/Shipping provider/)
      .first()
      .fill('DTDC');
    await dialog
      .getByLabel(/Tracking number/)
      .first()
      .fill('D1234567');
    await dialog.getByRole('button', { name: 'Update status' }).click();
    await expect(page.getByText('Order marked shipped')).toBeVisible();
    await page.keyboard.press('Escape');

    // The list behind the dialog shows the new status without leaving the page.
    await expect(statusCell).toContainText('Shipped');
  });

  test('replace an image in the library and see it everywhere it is used', async ({ page }) => {
    await signIn(page, FINAL);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.goto('/admin/media');
    const tile = page.getByRole('listitem').first();
    const before = await tile.locator('img').getAttribute('src');
    await tile.getByRole('button').click();
    await page.getByRole('button', { name: 'Replace image' }).click();
    await page.locator('input[type=file]').setInputFiles(IMAGE);
    await expect(page.getByLabel('Crop area. Use the arrow keys to move the image.')).toBeVisible();
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByAltText('Preview of the cropped image')).toBeVisible();
    await page.getByRole('button', { name: 'Replace image' }).click();
    await expect(page.getByText(/Image replaced/)).toBeVisible({ timeout: 60_000 });

    await page.goto('/admin/media');
    const after = await page.getByRole('listitem').first().locator('img').getAttribute('src');
    expect(after).not.toBe(before);
    const revision = after!.match(/\/r(\d+)\//)![1];
    // The product that uses this image now serves the new revision (storefront cache refreshes).
    await expect
      .poll(
        async () => {
          await page.goto('/products/e2e-glazed-pot');
          return page
            .getByRole('main')
            .locator('img')
            .first()
            .evaluate((img: HTMLImageElement) => img.currentSrc);
        },
        { timeout: 30_000 },
      )
      .toContain(`/r${revision}/`);
  });
});
