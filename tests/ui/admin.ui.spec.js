const { test, expect } = require('../../src/fixtures');
const { uid } = require('../../src/utils/dataFactory');

test.describe('Admin UI', () => {
  test('customers are redirected away from the admin panel', async ({ customerPage, page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL('/');
    await page.getByTestId('account-menu').click();
    await expect(page.getByTestId('nav-admin')).toHaveCount(0);
  });

  test('dashboard shows key stats @smoke', async ({ adminPage, page }) => {
    await page.goto('/admin');
    for (const id of ['stat-revenue', 'stat-orders', 'stat-to-fulfil', 'stat-customers']) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    await expect(page.getByTestId('low-stock')).toBeVisible();
  });

  test('validates the product form', async ({ adminPage, adminProductsPage }) => {
    await adminProductsPage.goto();
    await adminProductsPage.createProduct({ name: `E2E UI ${uid()}`, price: 1000, compareAtPrice: 800, stock: -1 });
    await expect(adminProductsPage.fieldError('stock')).toHaveText('Stock cannot be negative');
    await expect(adminProductsPage.fieldError('compareAtPrice')).toHaveText('Compare-at price must be greater than price');
    await expect(adminProductsPage.modal).toBeVisible();
  });

  test('creates, edits and deactivates a product that shoppers can see', async ({ adminPage, adminProductsPage, api }) => {
    const name = `E2E UI Product ${uid()}`;
    await adminProductsPage.goto();

    await adminProductsPage.createProduct({ name, description: 'Created from the admin UI', price: 2750, stock: 12 });
    await expect(adminProductsPage.toast('Product created')).toBeVisible();
    await expect(adminProductsPage.row(name)).toContainText('Rs 2,750');

    let { data } = await (await api.products({ search: name })).json();
    expect(data).toHaveLength(1);

    await adminProductsPage.edit(name, { price: 2500, stock: 4 });
    await expect(adminProductsPage.toast('Product updated')).toBeVisible();
    await expect(adminProductsPage.row(name).getByTestId('admin-product-stock')).toHaveText('4');

    await adminProductsPage.deactivate(name);
    await expect(adminProductsPage.row(name)).toContainText('Inactive');
    ({ data } = await (await api.products({ search: name })).json());
    expect(data).toHaveLength(0);
  });

  test('admin ships an order and the customer sees the new status', async ({ adminPage, adminOrdersPage, customer, createProduct, placeOrder, browser }) => {
    const product = await createProduct();
    const order = await placeOrder(customer, [{ product }]);

    await adminOrdersPage.goto();
    expect(await adminOrdersPage.availableTransitions(order.orderNumber)).toEqual(['paid', 'cancelled']);
    await adminOrdersPage.changeStatus(order.orderNumber, 'paid');
    await expect(adminOrdersPage.row(order.orderNumber).getByTestId('order-status')).toHaveText('Paid');
    await adminOrdersPage.changeStatus(order.orderNumber, 'shipped');
    await expect(adminOrdersPage.row(order.orderNumber).getByTestId('order-status')).toHaveText('Shipped');
    expect(await adminOrdersPage.availableTransitions(order.orderNumber)).toEqual(['delivered']);

    // Second, independent browser session for the customer
    const ctx = await browser.newContext();
    const customerTab = await ctx.newPage();
    await customerTab.addInitScript((t) => localStorage.setItem('novamart_token', t), customer.token);
    await customerTab.goto(`/orders/${order.id}`);
    await expect(customerTab.locator('.order-head').getByTestId('order-status')).toHaveText('Shipped');
    await ctx.close();
  });

  test('filters orders by status', async ({ adminPage, adminOrdersPage, customer, createProduct, placeOrder }) => {
    const product = await createProduct();
    await placeOrder(customer, [{ product }]);
    await adminOrdersPage.goto();
    await adminOrdersPage.filterByStatus('pending');
    const statuses = await adminOrdersPage.rows.getByTestId('order-status').allInnerTexts();
    expect(statuses.length).toBeGreaterThan(0);
    expect(new Set(statuses)).toEqual(new Set(['Pending']));
  });
});
