const { test, expect } = require('../../src/fixtures');
const { newProduct } = require('../../src/utils/dataFactory');
const { CARDS, MESSAGES } = require('../../src/data/testData');

test.describe('Admin API — access control', () => {
  const endpoints = [
    ['GET', '/admin/stats'],
    ['GET', '/admin/products'],
    ['GET', '/admin/orders'],
    ['GET', '/admin/users'],
    ['POST', '/admin/products'],
  ];
  for (const [method, path] of endpoints) {
    test(`${method} ${path} → 401 anonymous, 403 customer`, async ({ api, customer }) => {
      const call = (client) => (method === 'GET' ? client.get(path) : client.post(path, newProduct()));
      expect((await call(api)).status()).toBe(401);
      const res = await call(customer.api);
      expect(res.status()).toBe(403);
      expect((await res.json()).error.message).toBe(MESSAGES.adminRequired);
    });
  }
});

test.describe('Admin API — products', () => {
  test('creates a product that appears in the store @smoke', async ({ adminApi, api, createProduct }) => {
    const product = await createProduct({ price: 4321, stock: 7, compareAtPrice: 5000 });
    expect(product).toMatchObject({ price: 4321, compareAtPrice: 5000, stock: 7, inStock: true, isActive: true });
    expect(product.slug).toMatch(/^e2e-product-/);
    expect(product.imageUrl).toBe(`/img/${product.slug}.svg`);

    const { data } = await (await api.products({ search: product.name })).json();
    expect(data.map((p) => p.id)).toEqual([product.id]);
    expect((await adminApi.adminProducts(product.name)).ok()).toBe(true);
  });

  const invalid = [
    { title: 'negative stock', patch: { stock: -1 }, field: 'stock' },
    { title: 'zero price', patch: { price: 0 }, field: 'price' },
    { title: 'fractional stock', patch: { stock: 1.5 }, field: 'stock' },
    { title: 'compare-at price not above price', patch: { price: 1000, compareAtPrice: 900 }, field: 'compareAtPrice' },
    { title: 'missing name', patch: { name: '' }, field: 'name' },
  ];
  for (const { title, patch, field } of invalid) {
    test(`rejects a product with ${title}`, async ({ adminApi }) => {
      const res = await adminApi.createProduct(newProduct(patch));
      expect(res.status()).toBe(400);
      expect((await res.json()).error.details.map((d) => d.field)).toContain(field);
    });
  }

  test('rejects an unknown category', async ({ adminApi }) => {
    const res = await adminApi.createProduct(newProduct({ categoryId: 99999 }));
    expect(res.status()).toBe(400);
    expect((await res.json()).error.message).toBe('Category does not exist');
  });

  test('updates price and stock', async ({ adminApi, createProduct, api }) => {
    const product = await createProduct({ price: 1000, stock: 1 });
    const res = await adminApi.updateProduct(product.id, { name: product.name, price: 1250, stock: 9 });
    expect(res.status()).toBe(200);
    const { data } = await (await api.product(product.id)).json();
    expect(data).toMatchObject({ price: 1250, stock: 9 });
  });

  test('returns 404 when updating or deleting a missing product', async ({ adminApi }) => {
    expect((await adminApi.updateProduct(999999, newProduct())).status()).toBe(404);
    expect((await adminApi.deactivateProduct(999999)).status()).toBe(404);
  });
});

test.describe('Admin API — orders', () => {
  test('moves an order through the full fulfilment flow', async ({ adminApi, customer, createProduct, placeOrder }) => {
    const product = await createProduct();
    const order = await placeOrder(customer, [{ product }]);
    for (const status of ['paid', 'shipped', 'delivered']) {
      const res = await adminApi.updateOrderStatus(order.id, status);
      expect(res.status(), `→ ${status}`).toBe(200);
      expect((await res.json()).data.status).toBe(status);
    }
    const mine = await (await customer.api.order(order.id)).json();
    expect(mine.data.status).toBe('delivered');
  });

  const forbidden = [
    { setup: [], to: 'shipped', from: 'pending' },
    { setup: [], to: 'delivered', from: 'pending' },
    { setup: ['paid', 'shipped'], to: 'cancelled', from: 'shipped' },
    { setup: ['paid', 'shipped', 'delivered'], to: 'pending', from: 'delivered' },
  ];
  for (const { setup, to, from } of forbidden) {
    test(`rejects ${from} → ${to} with 409`, async ({ adminApi, customer, createProduct, placeOrder }) => {
      const product = await createProduct();
      const order = await placeOrder(customer, [{ product }]);
      for (const s of setup) await adminApi.updateOrderStatus(order.id, s);
      const res = await adminApi.updateOrderStatus(order.id, to);
      expect(res.status()).toBe(409);
      expect((await res.json()).error.message).toBe(`Cannot change order status from ${from} to ${to}`);
    });
  }

  test('admin cancellation restores stock', async ({ adminApi, customer, createProduct, placeOrder, api }) => {
    const product = await createProduct({ stock: 4 });
    const order = await placeOrder(customer, [{ product, quantity: 3 }], { paymentMethod: 'card', card: CARDS.success });
    await adminApi.updateOrderStatus(order.id, 'cancelled');
    expect((await (await api.product(product.id)).json()).data.stock).toBe(4);
  });

  test('filters orders by status and includes customer details', async ({ adminApi, customer, createProduct, placeOrder }) => {
    const product = await createProduct();
    const order = await placeOrder(customer, [{ product }], { paymentMethod: 'card', card: CARDS.success });
    const { data } = await (await adminApi.adminOrders('paid')).json();
    expect(data.every((o) => o.status === 'paid')).toBe(true);
    expect(data.find((o) => o.id === order.id)).toMatchObject({ customer: { email: customer.email, name: customer.name } });
  });

  test('dashboard stats have the expected shape', async ({ adminApi }) => {
    const { data } = await (await adminApi.adminStats()).json();
    for (const k of ['revenue', 'orders', 'customers', 'products', 'ordersToFulfil']) expect(data[k]).toBeGreaterThanOrEqual(0);
    expect(data.lowStock.every((p) => p.stock <= 5)).toBe(true);
    expect(data.recentOrders.length).toBeLessThanOrEqual(5);
  });
});
