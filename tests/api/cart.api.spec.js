const { test, expect } = require('../../src/fixtures');
const { RULES, COUPONS, MESSAGES } = require('../../src/data/testData');
const { expectedTotals } = require('../../src/utils/price');

test.describe('Cart API', () => {
  test('requires authentication', async ({ api }) => {
    expect((await api.cart()).status()).toBe(401);
    expect((await api.addToCart(1, 1)).status()).toBe(401);
  });

  test('new customers start with an empty cart', async ({ customer }) => {
    const cart = await (await customer.api.cart()).json();
    expect(cart).toEqual({ items: [], itemCount: 0, totals: { subtotal: 0, discount: 0, shippingFee: 0, total: 0, couponCode: null } });
  });

  test('adds an item and calculates totals with delivery fee @smoke', async ({ customer, createProduct }) => {
    const product = await createProduct({ price: 1200, stock: 10 });
    const res = await customer.api.addToCart(product.id, 2);
    expect(res.status()).toBe(201);
    const cart = await res.json();
    expect(cart.itemCount).toBe(2);
    expect(cart.items[0]).toMatchObject({ productId: product.id, quantity: 2, unitPrice: 1200, lineTotal: 2400, available: true });
    expect(cart.totals).toMatchObject(expectedTotals({ subtotal: 2400, rules: RULES }));
    expect(cart.totals.shippingFee).toBe(RULES.shippingFee);
  });

  test(`delivery is free when subtotal reaches Rs ${RULES.freeShippingThreshold}`, async ({ customer, createProduct }) => {
    const product = await createProduct({ price: 2500, stock: 10 });
    const below = await (await customer.api.addToCart(product.id, 1)).json();
    expect(below.totals.shippingFee).toBe(RULES.shippingFee);
    const exact = await (await customer.api.addToCart(product.id, 1)).json(); // 5000 exactly
    expect(exact.totals.subtotal).toBe(RULES.freeShippingThreshold);
    expect(exact.totals.shippingFee).toBe(0);
  });

  test('adding the same product again increases its quantity', async ({ customer, createProduct }) => {
    const product = await createProduct({ stock: 10 });
    await customer.api.addToCart(product.id, 2);
    const cart = await (await customer.api.addToCart(product.id, 3)).json();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(5);
  });

  test('cannot add more than the available stock', async ({ customer, createProduct }) => {
    const product = await createProduct({ stock: 3 });
    await customer.api.addToCart(product.id, 2);
    const res = await customer.api.addToCart(product.id, 2);
    expect(res.status()).toBe(400);
    expect((await res.json()).error.message).toBe(MESSAGES.onlyNInStock(3));
  });

  test('cannot add an out-of-stock product', async ({ customer, createProduct }) => {
    const product = await createProduct({ stock: 0 });
    const res = await customer.api.addToCart(product.id, 1);
    expect(res.status()).toBe(400);
    expect((await res.json()).error.message).toBe(MESSAGES.outOfStock);
  });

  test('rejects unknown products and invalid quantities', async ({ customer }) => {
    expect((await customer.api.addToCart(999999, 1)).status()).toBe(404);
    expect((await customer.api.addToCart(1, 0)).status()).toBe(400);
    expect((await customer.api.addToCart(1, 100)).status()).toBe(400);
  });

  test('updates the quantity of an item', async ({ customer, createProduct }) => {
    const product = await createProduct({ price: 1000, stock: 10 });
    await customer.api.addToCart(product.id, 1);
    const res = await customer.api.updateCartItem(product.id, 4);
    expect(res.status()).toBe(200);
    const cart = await res.json();
    expect(cart.items[0].quantity).toBe(4);
    expect(cart.totals.subtotal).toBe(4000);
  });

  test('removes an item and returns 404 when it is not in the cart', async ({ customer, createProduct }) => {
    const product = await createProduct();
    await customer.api.addToCart(product.id, 1);
    const removed = await (await customer.api.removeCartItem(product.id)).json();
    expect(removed.items).toHaveLength(0);
    expect((await customer.api.removeCartItem(product.id)).status()).toBe(404);
  });

  test('clears the whole cart', async ({ customer, createProduct }) => {
    const [a, b] = [await createProduct(), await createProduct()];
    await customer.api.addToCart(a.id, 1);
    await customer.api.addToCart(b.id, 1);
    const cart = await (await customer.api.clearCart()).json();
    expect(cart.itemCount).toBe(0);
  });

  test('a deactivated product is removed from carts', async ({ customer, createProduct, adminApi }) => {
    const product = await createProduct();
    await customer.api.addToCart(product.id, 1);
    await adminApi.deactivateProduct(product.id);
    const cart = await (await customer.api.cart()).json();
    expect(cart.items).toHaveLength(0);
  });

  test('carts are private to each customer', async ({ customer, createProduct, api }) => {
    const product = await createProduct();
    await customer.api.addToCart(product.id, 1);
    const other = await api.register(require('../../src/utils/dataFactory').newUser());
    const otherCart = await (await api.withToken((await other.json()).token).cart()).json();
    expect(otherCart.items).toHaveLength(0);
  });
});

test.describe('Coupons API', () => {
  test(`${COUPONS.percent10.code} gives ${COUPONS.percent10.value}% off`, async ({ customer, createProduct }) => {
    const product = await createProduct({ price: 3333, stock: 10 });
    await customer.api.addToCart(product.id, 1);
    const res = await customer.api.applyCoupon(COUPONS.percent10.code);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.coupon).toMatchObject({ code: COUPONS.percent10.code, type: 'percent', value: 10 });
    expect(body.totals).toMatchObject(expectedTotals({ subtotal: 3333, coupon: COUPONS.percent10, rules: RULES }));
  });

  test(`${COUPONS.flat500.code} gives Rs ${COUPONS.flat500.value} off`, async ({ customer, createProduct }) => {
    const product = await createProduct({ price: 3000, stock: 10 });
    await customer.api.addToCart(product.id, 1);
    const body = await (await customer.api.applyCoupon(COUPONS.flat500.code)).json();
    expect(body.totals).toMatchObject({ subtotal: 3000, discount: 500, shippingFee: RULES.shippingFee, total: 2750 });
  });

  test('coupon codes are case-insensitive', async ({ customer, createProduct }) => {
    const product = await createProduct({ price: 3000, stock: 10 });
    await customer.api.addToCart(product.id, 1);
    expect((await customer.api.applyCoupon('welcome10')).status()).toBe(200);
  });

  test('enforces the minimum subtotal', async ({ customer, createProduct }) => {
    const product = await createProduct({ price: 1999, stock: 10 });
    await customer.api.addToCart(product.id, 1);
    const res = await customer.api.applyCoupon(COUPONS.percent10.code);
    expect(res.status()).toBe(400);
    expect((await res.json()).error.message).toBe(MESSAGES.couponMinimum(COUPONS.percent10.minSubtotal));
  });

  const rejected = [
    { code: COUPONS.expired.code, message: MESSAGES.couponExpired },
    { code: COUPONS.inactive.code, message: MESSAGES.couponInvalid },
    { code: 'NOSUCHCODE', message: MESSAGES.couponInvalid },
  ];
  for (const { code, message } of rejected) {
    test(`rejects coupon ${code}`, async ({ customer, createProduct }) => {
      const product = await createProduct({ price: 5000, stock: 10 });
      await customer.api.addToCart(product.id, 1);
      const res = await customer.api.applyCoupon(code);
      expect(res.status()).toBe(400);
      expect((await res.json()).error.message).toBe(message);
    });
  }

  test('cannot apply a coupon to an empty cart', async ({ customer }) => {
    const res = await customer.api.applyCoupon(COUPONS.percent10.code);
    expect(res.status()).toBe(400);
    expect((await res.json()).error.message).toBe(MESSAGES.emptyCart);
  });
});
