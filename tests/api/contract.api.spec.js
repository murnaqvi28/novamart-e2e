const { test, expect } = require('../../src/fixtures');
const { USERS, CARDS } = require('../../src/data/testData');

/**
 * Contract tests: every response body must match the schema published in the app's OpenAPI spec.
 */
test.describe('API contract (OpenAPI schema validation)', () => {
  test('product list matches the Product schema', async ({ api, schema }) => {
    const { data, pagination } = await (await api.products({ limit: 50 })).json();
    expect(schema.validate('Pagination', pagination)).toEqual([]);
    for (const p of data) expect(schema.validate('Product', p), p.slug).toEqual([]);
  });

  test('categories match the Category schema', async ({ api, schema }) => {
    const { data } = await (await api.categories()).json();
    for (const c of data) expect(schema.validate('Category', c)).toEqual([]);
  });

  test('login response matches AuthResponse', async ({ api, schema }) => {
    const body = await (await api.login(USERS.customer.email, USERS.customer.password)).json();
    expect(schema.validate('AuthResponse', body)).toEqual([]);
  });

  test('cart matches the Cart schema', async ({ customer, createProduct, schema }) => {
    const product = await createProduct();
    const cart = await (await customer.api.addToCart(product.id, 1)).json();
    expect(schema.validate('Cart', cart)).toEqual([]);
  });

  test('order matches the Order schema', async ({ customer, createProduct, placeOrder, schema }) => {
    const product = await createProduct();
    const order = await placeOrder(customer, [{ product }], { paymentMethod: 'card', card: CARDS.success });
    expect(schema.validate('Order', order)).toEqual([]);
  });

  test('errors follow the standard Error schema', async ({ api, schema }) => {
    const responses = await Promise.all([
      api.product('missing-product'),
      api.login('x@example.com', 'wrong'),
      api.register({}),
      api.get('/no-such-route'),
    ]);
    for (const res of responses) {
      expect(res.headers()['content-type']).toContain('application/json');
      expect(schema.validate('Error', await res.json())).toEqual([]);
    }
  });

  test('every documented path is reachable (no 404 route mismatch)', async ({ api, schema }) => {
    const paths = Object.keys(schema.spec.paths).filter((p) => !p.includes('{') && schema.spec.paths[p].get);
    for (const p of paths) {
      const res = await api.get(p);
      expect(res.status(), p).not.toBe(404);
    }
  });
});
