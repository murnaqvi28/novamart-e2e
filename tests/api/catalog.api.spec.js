const { test, expect } = require('../../src/fixtures');

test.describe('Catalog API', () => {
  test('lists products with default pagination @smoke', async ({ api }) => {
    const res = await api.products();
    expect(res.status()).toBe(200);
    const { data, pagination } = await res.json();
    expect(pagination).toMatchObject({ page: 1, limit: 12 });
    expect(data.length).toBeLessThanOrEqual(12);
    expect(pagination.totalPages).toBe(Math.ceil(pagination.total / 12));
  });

  test('search matches product name or description (case-insensitive)', async ({ api }) => {
    const { data } = await (await api.products({ search: 'HEADPHONES' })).json();
    expect(data.length).toBeGreaterThan(0);
    for (const p of data) expect(`${p.name} ${p.description}`.toLowerCase()).toContain('headphones');
  });

  test('returns an empty list for a search with no matches', async ({ api }) => {
    const { data, pagination } = await (await api.products({ search: 'zzz-no-such-product' })).json();
    expect(data).toEqual([]);
    expect(pagination.total).toBe(0);
  });

  test('filters by category', async ({ api }) => {
    const { data } = await (await api.products({ category: 'electronics', limit: 50 })).json();
    expect(data.length).toBeGreaterThan(0);
    for (const p of data) expect(p.category.slug).toBe('electronics');
  });

  test('category product counts match the filtered listing', async ({ api }) => {
    const { data: categories } = await (await api.categories()).json();
    for (const c of categories) {
      const { pagination } = await (await api.products({ category: c.slug })).json();
      expect(pagination.total, `count for ${c.slug}`).toBe(c.productCount);
    }
  });

  test('filters by price range (inclusive)', async ({ api }) => {
    const { data } = await (await api.products({ minPrice: 2000, maxPrice: 5000, limit: 50 })).json();
    expect(data.length).toBeGreaterThan(0);
    for (const p of data) {
      expect(p.price).toBeGreaterThanOrEqual(2000);
      expect(p.price).toBeLessThanOrEqual(5000);
    }
  });

  test('inStock=true excludes sold-out products', async ({ api }) => {
    const { data } = await (await api.products({ inStock: 'true', limit: 50 })).json();
    for (const p of data) expect(p.stock).toBeGreaterThan(0);
  });

  const sorts = [
    { sort: 'price_asc', key: 'price', dir: 1 },
    { sort: 'price_desc', key: 'price', dir: -1 },
  ];
  for (const { sort, key, dir } of sorts) {
    test(`sorts by ${sort}`, async ({ api }) => {
      const { data } = await (await api.products({ sort, limit: 50 })).json();
      const values = data.map((p) => p[key]);
      const sorted = [...values].sort((a, b) => (typeof a === 'number' ? (a - b) * dir : a.localeCompare(b) * dir));
      expect(values).toEqual(sorted);
    });
  }

  test('pages do not overlap', async ({ api }) => {
    const p1 = await (await api.products({ page: 1, limit: 5, sort: 'name_asc' })).json();
    const p2 = await (await api.products({ page: 2, limit: 5, sort: 'name_asc' })).json();
    const ids1 = p1.data.map((p) => p.id);
    for (const p of p2.data) expect(ids1).not.toContain(p.id);
  });

  const badQueries = [{ limit: 'abc' }, { limit: 0 }, { limit: 51 }, { page: 0 }, { sort: 'random' }];
  for (const params of badQueries) {
    test(`rejects invalid query ${JSON.stringify(params)} with 400`, async ({ api }) => {
      const res = await api.products(params);
      expect(res.status()).toBe(400);
      expect((await res.json()).error.code).toBe('BAD_REQUEST');
    });
  }

  test('gets a product by slug and by id with the same data', async ({ api }) => {
    const bySlug = await (await api.product('aero-wireless-headphones')).json();
    const byId = await (await api.product(bySlug.data.id)).json();
    expect(byId.data).toEqual(bySlug.data);
    expect(bySlug.related.every((r) => r.category.id === bySlug.data.category.id && r.id !== bySlug.data.id)).toBe(true);
  });

  test('returns 404 for an unknown product', async ({ api }) => {
    const res = await api.product('this-product-does-not-exist');
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toEqual({ code: 'NOT_FOUND', message: 'Product not found' });
  });

  test('hides deactivated products from the public catalog', async ({ api, adminApi, createProduct }) => {
    const product = await createProduct();
    expect((await api.product(product.slug)).status()).toBe(200);
    await adminApi.deactivateProduct(product.id);
    expect((await api.product(product.slug)).status()).toBe(404);
    const { data } = await (await api.products({ search: product.name })).json();
    expect(data).toHaveLength(0);
  });

  test('customers can review a product once and the rating updates', async ({ customer, createProduct, api }) => {
    const product = await createProduct();
    const first = await customer.api.addReview(product.id, { rating: 4, comment: 'Good value for money' });
    expect(first.status()).toBe(201);
    expect((await first.json()).data).toMatchObject({ rating: 4, userName: customer.name });

    const again = await customer.api.addReview(product.id, { rating: 5, comment: 'Second try' });
    expect(again.status()).toBe(409);

    const { data } = await (await api.product(product.id)).json();
    expect(data).toMatchObject({ rating: 4, reviewCount: 1 });
  });

  test('rejects a review with an out-of-range rating', async ({ customer, createProduct }) => {
    const product = await createProduct();
    const res = await customer.api.addReview(product.id, { rating: 6, comment: 'Too good' });
    expect(res.status()).toBe(400);
  });
});
