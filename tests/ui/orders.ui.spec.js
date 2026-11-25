const { test, expect } = require('../../src/fixtures');
const { CARDS } = require('../../src/data/testData');

test.describe('My orders UI', () => {
  test('new customer sees an empty order history', async ({ customerPage, ordersPage }) => {
    await ordersPage.goto();
    await expect(ordersPage.empty).toBeVisible();
  });

  test('order history lists orders and opens the detail page', async ({ customerPage, customer, ordersPage, orderDetailPage, createProduct, placeOrder }) => {
    const product = await createProduct({ price: 1000 });
    const order = await placeOrder(customer, [{ product, quantity: 3 }]);

    await ordersPage.goto();
    const row = ordersPage.row(order.orderNumber);
    await expect(row).toContainText('3 items');
    await expect(row.getByTestId('order-status')).toHaveText('Pending');
    await expect(row.getByTestId('order-total')).toHaveText('Rs 3,250');

    await row.click();
    await expect(orderDetailPage.orderNumber).toHaveText(order.orderNumber);
    await expect(orderDetailPage.items).toHaveCount(1);
  });

  test('customer can cancel a pending order', async ({ customerPage, customer, orderDetailPage, createProduct, placeOrder, api }) => {
    const product = await createProduct({ stock: 5 });
    const order = await placeOrder(customer, [{ product, quantity: 2 }]);

    await orderDetailPage.goto(order.id);
    await orderDetailPage.cancel();
    await expect(orderDetailPage.status).toHaveText('Cancelled');
    await expect(orderDetailPage.cancelButton).toBeHidden();
    await expect(orderDetailPage.timeline).toBeHidden();
    expect((await (await api.product(product.id)).json()).data.stock).toBe(5);
  });

  test('shipped orders cannot be cancelled and show progress', async ({ customerPage, customer, orderDetailPage, createProduct, placeOrder, adminApi }) => {
    const product = await createProduct();
    const order = await placeOrder(customer, [{ product }], { paymentMethod: 'card', card: CARDS.success });
    await adminApi.updateOrderStatus(order.id, 'shipped');

    await orderDetailPage.goto(order.id);
    await expect(orderDetailPage.status).toHaveText('Shipped');
    await expect(orderDetailPage.cancelButton).toBeHidden();
    await expect(orderDetailPage.timeline.locator('li.done')).toHaveCount(3);
  });

  test("another customer's order is not accessible", async ({ customerPage, orderDetailPage, createProduct, placeOrder, api }) => {
    const product = await createProduct();
    const { token } = await (await api.register(require('../../src/utils/dataFactory').newUser())).json();
    const otherCustomer = { api: api.withToken(token) };
    const order = await placeOrder(otherCustomer, [{ product }]);

    await orderDetailPage.goto(order.id);
    await expect(orderDetailPage.notFound).toContainText('Order not found');
  });
});
