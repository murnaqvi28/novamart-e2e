const { test, expect } = require('../../src/fixtures');
const { CARDS, COUPONS, MESSAGES, RULES } = require('../../src/data/testData');
const { shippingAddress } = require('../../src/utils/dataFactory');
const { expectedTotals } = require('../../src/utils/price');

test.describe('Checkout UI', () => {
  /** Every test starts logged in with one product (Rs 3,000) in the cart, on the checkout page. */
  test.beforeEach(async ({ customerPage, customer, createProduct, checkoutPage }) => {
    const product = await createProduct({ price: 3000, stock: 10 });
    await customer.api.addToCart(product.id, 1);
    await checkoutPage.goto();
  });

  test('shows field errors for invalid delivery details', async ({ checkoutPage }) => {
    await checkoutPage.fillShipping({ phone: '12345', postalCode: '123' });
    await checkoutPage.placeOrder();
    await expect(checkoutPage.formError).toHaveText('Please fix the highlighted fields.');
    await expect(checkoutPage.fieldError('phone')).toHaveText('Enter a valid Pakistani mobile number, e.g. 03001234567');
    await expect(checkoutPage.fieldError('address')).toHaveText('Address is required');
    await expect(checkoutPage.fieldError('postalCode')).toHaveText('Postal code must be 5 digits');
  });

  test('applies a valid coupon and updates the total', async ({ checkoutPage }) => {
    await checkoutPage.applyCoupon(COUPONS.flat500.code);
    await expect(checkoutPage.couponApplied).toContainText(COUPONS.flat500.code);
    expect(await checkoutPage.summary()).toMatchObject(expectedTotals({ subtotal: 3000, coupon: COUPONS.flat500, rules: RULES }));
  });

  test('removing a coupon restores the original total', async ({ checkoutPage }) => {
    await checkoutPage.applyCoupon(COUPONS.percent10.code);
    await expect(checkoutPage.discount).toBeVisible();
    await checkoutPage.couponRemove.click();
    await expect(checkoutPage.discount).toBeHidden();
    await expect(checkoutPage.total).toHaveText('Rs 3,250');
  });

  for (const { code, message } of [
    { code: COUPONS.expired.code, message: MESSAGES.couponExpired },
    { code: COUPONS.inactive.code, message: MESSAGES.couponInvalid },
  ]) {
    test(`shows an error for coupon ${code}`, async ({ checkoutPage }) => {
      await checkoutPage.applyCoupon(code);
      await expect(checkoutPage.couponError).toHaveText(message);
      await expect(checkoutPage.discount).toBeHidden();
    });
  }

  test('declined card shows an error and stays on checkout', async ({ checkoutPage, page }) => {
    await checkoutPage.fillShipping(shippingAddress());
    await checkoutPage.payWithCard(CARDS.declined);
    await checkoutPage.placeOrder();
    await expect(checkoutPage.formError).toHaveText(MESSAGES.cardDeclined);
    await expect(page).toHaveURL('/checkout');
  });

  test('card form validates number and expiry', async ({ checkoutPage }) => {
    await checkoutPage.fillShipping(shippingAddress());
    await checkoutPage.payWithCard(CARDS.invalidLuhn);
    await checkoutPage.cardExpiry.fill('0120');
    await checkoutPage.placeOrder();
    await expect(checkoutPage.fieldError('card-number')).toHaveText('Card number is invalid');
    await expect(checkoutPage.fieldError('card-expiry')).toHaveText('Card has expired');
  });

  test('cash on delivery order is placed as pending', async ({ checkoutPage, orderDetailPage, page }) => {
    await checkoutPage.fillShipping(shippingAddress());
    await checkoutPage.payCashOnDelivery();
    await checkoutPage.placeOrder();
    await expect(page).toHaveURL(/\/orders\/\d+\?placed=1/);
    await expect(orderDetailPage.successBanner).toBeVisible();
    await expect(orderDetailPage.status).toHaveText('Pending');
    await expect(orderDetailPage.payment).toContainText('Cash on delivery');
  });

  test('card order is placed as paid and the cart is emptied @smoke', async ({ checkoutPage, orderDetailPage, customer }) => {
    await checkoutPage.fillShipping(shippingAddress({ city: 'Lahore' }));
    await checkoutPage.payWithCard(CARDS.success);
    await checkoutPage.placeOrder();

    await expect(orderDetailPage.successBanner).toBeVisible();
    await expect(orderDetailPage.status).toHaveText('Paid');
    await expect(orderDetailPage.payment).toContainText('Card ending in 4242');
    await expect(orderDetailPage.shipping).toContainText('Lahore');
    await expect(orderDetailPage.header.cartCount).toBeHidden();

    // Verify through the API that what the UI shows was actually saved
    const { data } = await (await customer.api.order(orderDetailPage.orderId())).json();
    expect(data).toMatchObject({ status: 'paid', cardLast4: '4242', total: 3250 });
    await expect(orderDetailPage.successOrderNumber).toHaveText(data.orderNumber);
  });
});
