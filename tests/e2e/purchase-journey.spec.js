const { test, expect } = require('../../src/fixtures');
const { CARDS, COUPONS, RULES } = require('../../src/data/testData');
const { newUser, shippingAddress } = require('../../src/utils/dataFactory');
const { expectedTotals } = require('../../src/utils/price');

/**
 * Full customer journey through the real UI, with checkpoints verified against the API.
 * register → search → product → cart → checkout with coupon → card payment → order history → admin ships → customer sees shipped
 */
test.describe('Purchase journey', () => {
  test('new customer buys a product end-to-end @smoke @mobile', async ({
    page, registerPage, shopPage, productPage, cartPage, checkoutPage, orderDetailPage, ordersPage, createProduct, adminApi, api,
  }) => {
    const product = await createProduct({ price: 2200, compareAtPrice: 2800, stock: 8, description: 'Journey test product' });
    const user = newUser();
    const address = shippingAddress({ city: 'Islamabad' });
    const quantity = 2;
    const expected = expectedTotals({ subtotal: 2200 * quantity, coupon: COUPONS.percent10, rules: RULES });

    await test.step('register a new account', async () => {
      await registerPage.goto();
      await registerPage.register(user);
      await expect(page).toHaveURL('/');
    });

    await test.step('find the product through search', async () => {
      await shopPage.header.search(product.name);
      await expect(shopPage.resultCount).toHaveText('1 product');
      await shopPage.openProduct(product.name);
      await expect(productPage.title).toHaveText(product.name);
      await expect(productPage.comparePrice).toHaveText('Rs 2,800');
    });

    await test.step(`add ${quantity} to the cart`, async () => {
      await productPage.addToCart(quantity);
      await expect(productPage.header.cartCount).toHaveText(String(quantity));
      await productPage.header.openCart();
      await expect(cartPage.quantity(product.name)).toHaveText(String(quantity));
      await cartPage.proceedToCheckout();
    });

    await test.step('check out with a coupon and card', async () => {
      await checkoutPage.fillShipping(address);
      await checkoutPage.applyCoupon(COUPONS.percent10.code);
      expect(await checkoutPage.summary()).toMatchObject(expected);
      await checkoutPage.payWithCard(CARDS.success);
      await checkoutPage.placeOrder();
      await expect(orderDetailPage.successBanner).toBeVisible();
      await expect(orderDetailPage.status).toHaveText('Paid');
      expect(await orderDetailPage.totalValue()).toBe(expected.total);
    });

    const orderId = orderDetailPage.orderId();
    const orderNumber = await orderDetailPage.orderNumber.innerText();

    await test.step('backend recorded the order and reduced stock', async () => {
      const { data: order } = await (await adminApi.adminOrder(orderId)).json();
      expect(order).toMatchObject({
        orderNumber, status: 'paid', couponCode: COUPONS.percent10.code, total: expected.total,
        customer: { email: user.email }, shipping: { city: 'Islamabad', phone: address.phone },
      });
      const { data: p } = await (await api.product(product.id)).json();
      expect(p.stock).toBe(8 - quantity);
    });

    await test.step('order appears in order history', async () => {
      await ordersPage.goto();
      await expect(ordersPage.row(orderNumber)).toBeVisible();
    });

    await test.step('admin ships it and the customer sees the update', async () => {
      await adminApi.updateOrderStatus(orderId, 'shipped');
      await orderDetailPage.goto(orderId);
      await expect(orderDetailPage.status).toHaveText('Shipped');
      await expect(orderDetailPage.cancelButton).toBeHidden();
    });
  });
});
