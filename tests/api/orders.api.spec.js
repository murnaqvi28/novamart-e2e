const { test, expect } = require('../../src/fixtures');
const { RULES, CARDS, COUPONS, MESSAGES } = require('../../src/data/testData');
const { shippingAddress } = require('../../src/utils/dataFactory');
const { expectedTotals } = require('../../src/utils/price');

const stockOf = async (api, id) => (await (await api.product(id)).json()).data.stock;

test.describe('Orders API', () => {
  test('cash on delivery order is pending and totals are correct @smoke', async ({ customer, createProduct, api }) => {
    const product = await createProduct({ price: 1800, stock: 10 });
    await customer.api.addToCart(product.id, 2);
    const shipping = shippingAddress();

    const res = await customer.api.placeOrder({ shipping, paymentMethod: 'cod' });
    expect(res.status()).toBe(201);
    const { data: order } = await res.json();

    expect(order.orderNumber).toMatch(/^NM-\d{8}-[A-Z0-9]{6}$/);
    expect(order).toMatchObject({ status: 'pending', paymentMethod: 'cod', cardLast4: null, shipping });
    expect(order).toMatchObject(expectedTotals({ subtotal: 3600, rules: RULES }));
    expect(order.items).toEqual([expect.objectContaining({ productId: product.id, quantity: 2, unitPrice: 1800, lineTotal: 3600 })]);

    // Side effects: stock reduced, cart emptied
    expect(await stockOf(api, product.id)).toBe(8);
    expect((await (await customer.api.cart()).json()).itemCount).toBe(0);
  });

  test('successful card payment marks the order as paid', async ({ customer, createProduct }) => {
    const product = await createProduct({ price: 6000, stock: 5 });
    await customer.api.addToCart(product.id, 1);
    const res = await customer.api.placeOrder({ shipping: shippingAddress(), paymentMethod: 'card', card: CARDS.success });
    expect(res.status()).toBe(201);
    const { data } = await res.json();
    expect(data).toMatchObject({ status: 'paid', paymentMethod: 'card', cardLast4: '4242', shippingFee: 0, total: 6000 });
  });

  test('applies a coupon at checkout', async ({ customer, createProduct }) => {
    const product = await createProduct({ price: 2500, stock: 5 });
    await customer.api.addToCart(product.id, 1);
    const { data } = await (await customer.api.placeOrder({ shipping: shippingAddress(), paymentMethod: 'cod', couponCode: COUPONS.percent10.code })).json();
    expect(data).toMatchObject({ couponCode: 'WELCOME10', ...expectedTotals({ subtotal: 2500, coupon: COUPONS.percent10, rules: RULES }) });
  });

  const declined = [
    { card: CARDS.declined, status: 402, code: 'PAYMENT_DECLINED', message: MESSAGES.cardDeclined },
    { card: CARDS.insufficientFunds, status: 402, code: 'INSUFFICIENT_FUNDS', message: MESSAGES.insufficientFunds },
  ];
  for (const { card, status, code, message } of declined) {
    test(`payment failure ${code} keeps cart and stock unchanged`, async ({ customer, createProduct, api }) => {
      const product = await createProduct({ stock: 5 });
      await customer.api.addToCart(product.id, 1);
      const res = await customer.api.placeOrder({ shipping: shippingAddress(), paymentMethod: 'card', card });
      expect(res.status()).toBe(status);
      expect((await res.json()).error).toEqual({ code, message });
      expect(await stockOf(api, product.id)).toBe(5);
      expect((await (await customer.api.cart()).json()).itemCount).toBe(1);
      expect((await (await customer.api.orders()).json()).data).toHaveLength(0);
    });
  }

  test('returns field-level errors for invalid delivery and card details', async ({ customer, createProduct }) => {
    const product = await createProduct();
    await customer.api.addToCart(product.id, 1);
    const res = await customer.api.placeOrder({
      shipping: { name: 'A', phone: '12345', address: '', city: '', postalCode: '4600' },
      paymentMethod: 'card',
      card: { number: CARDS.invalidLuhn.number, expiry: '13/30', cvv: '12', nameOnCard: '' },
    });
    expect(res.status()).toBe(400);
    const fields = (await res.json()).error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining([
      'shipping.name', 'shipping.phone', 'shipping.address', 'shipping.city', 'shipping.postalCode',
      'card.number', 'card.expiry', 'card.cvv', 'card.nameOnCard',
    ]));
  });

  const phones = [
    { phone: '03001234567', ok: true },
    { phone: '+923001234567', ok: true },
    { phone: '3001234567', ok: false },
    { phone: '04001234567', ok: false },
    { phone: '0300123456', ok: false },
  ];
  for (const { phone, ok } of phones) {
    test(`phone ${phone} is ${ok ? 'accepted' : 'rejected'}`, async ({ customer, createProduct }) => {
      const product = await createProduct();
      await customer.api.addToCart(product.id, 1);
      const res = await customer.api.placeOrder({ shipping: shippingAddress({ phone }), paymentMethod: 'cod' });
      expect(res.status()).toBe(ok ? 201 : 400);
    });
  }

  test('rejects an expired card', async ({ customer, createProduct }) => {
    const product = await createProduct();
    await customer.api.addToCart(product.id, 1);
    const res = await customer.api.placeOrder({ shipping: shippingAddress(), paymentMethod: 'card', card: CARDS.expired });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.details).toContainEqual({ field: 'card.expiry', message: 'Card has expired' });
  });

  test('requires card details for card payments', async ({ customer, createProduct }) => {
    const product = await createProduct();
    await customer.api.addToCart(product.id, 1);
    const res = await customer.api.placeOrder({ shipping: shippingAddress(), paymentMethod: 'card' });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.details).toContainEqual({ field: 'card', message: 'Card details are required for card payment' });
  });

  test('cannot check out an empty cart', async ({ customer }) => {
    const res = await customer.api.placeOrder({ shipping: shippingAddress(), paymentMethod: 'cod' });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.message).toBe(MESSAGES.emptyCart);
  });

  test('cannot buy more than the stock left when it changed after adding to cart', async ({ customer, createProduct, adminApi }) => {
    const product = await createProduct({ stock: 5 });
    await customer.api.addToCart(product.id, 4);
    await adminApi.updateProduct(product.id, { name: product.name, price: product.price, stock: 2 });
    const res = await customer.api.placeOrder({ shipping: shippingAddress(), paymentMethod: 'cod' });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.message).toBe(`Only 2 of "${product.name}" left in stock`);
  });

  test('lists my orders newest first and fetches one by id', async ({ customer, createProduct, placeOrder }) => {
    const product = await createProduct({ stock: 10 });
    const first = await placeOrder(customer, [{ product }]);
    const second = await placeOrder(customer, [{ product, quantity: 2 }]);
    const { data } = await (await customer.api.orders()).json();
    expect(data.map((o) => o.id)).toEqual([second.id, first.id]);
    expect(data[0].itemCount).toBe(2);
    const one = await (await customer.api.order(first.id)).json();
    expect(one.data.orderNumber).toBe(first.orderNumber);
  });

  test("customers cannot see another customer's order", async ({ customer, createProduct, placeOrder, api }) => {
    const product = await createProduct();
    const order = await placeOrder(customer, [{ product }]);
    const { token } = await (await api.register(require('../../src/utils/dataFactory').newUser())).json();
    const res = await api.withToken(token).order(order.id);
    expect(res.status()).toBe(404);
  });

  test('cancelling a pending order restores stock', async ({ customer, createProduct, placeOrder, api }) => {
    const product = await createProduct({ stock: 6 });
    const order = await placeOrder(customer, [{ product, quantity: 4 }]);
    expect(await stockOf(api, product.id)).toBe(2);
    const res = await customer.api.cancelOrder(order.id);
    expect(res.status()).toBe(200);
    expect((await res.json()).data.status).toBe('cancelled');
    expect(await stockOf(api, product.id)).toBe(6);
  });

  test('cannot cancel an order that has shipped', async ({ customer, createProduct, placeOrder, adminApi }) => {
    const product = await createProduct();
    const order = await placeOrder(customer, [{ product }], { paymentMethod: 'card', card: CARDS.success });
    await adminApi.updateOrderStatus(order.id, 'shipped');
    const res = await customer.api.cancelOrder(order.id);
    expect(res.status()).toBe(400);
    expect((await res.json()).error.message).toBe('Order cannot be cancelled once it is shipped');
  });
});
