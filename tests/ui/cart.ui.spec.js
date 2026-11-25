const { test, expect } = require('../../src/fixtures');
const { RULES } = require('../../src/data/testData');
const { expectedTotals } = require('../../src/utils/price');

test.describe('Cart UI', () => {
  test('guest clicking Add to cart is sent to login and back', async ({ page, productPage, loginPage, customer, createProduct }) => {
    const product = await createProduct();
    await productPage.goto(product.slug);
    await productPage.addToCartButton.click();
    await expect(page).toHaveURL(`/login?redirect=${encodeURIComponent(`/product/${product.slug}`)}`);
    await loginPage.login(customer.email, customer.password);
    await expect(productPage.title).toHaveText(product.name);
  });

  test('adding to cart updates the header badge @smoke @mobile', async ({ customerPage, productPage, createProduct }) => {
    const product = await createProduct();
    await productPage.goto(product.slug);
    await productPage.addToCart(2);
    await expect(productPage.toast(`${product.name} added to cart`)).toBeVisible();
    await expect(productPage.header.cartCount).toHaveText('2');
  });

  test('cart shows line totals, delivery fee and free-delivery hint', async ({ customerPage, customer, cartPage, createProduct }) => {
    const product = await createProduct({ price: 1500, stock: 10 });
    await customer.api.addToCart(product.id, 2);
    await cartPage.goto();

    await expect(cartPage.lineTotal(product.name)).toHaveText('Rs 3,000');
    await expect(cartPage.freeShippingHint).toHaveText('Add Rs 2,000 more to get free delivery.');
    expect(await cartPage.summary()).toMatchObject(expectedTotals({ subtotal: 3000, rules: RULES }));
  });

  test('changing quantity recalculates totals and removes the delivery fee', async ({ customerPage, customer, cartPage, createProduct }) => {
    const product = await createProduct({ price: 2500, stock: 10 });
    await customer.api.addToCart(product.id, 1);
    await cartPage.goto();
    await expect(cartPage.shipping).toHaveText('Rs 250');

    await cartPage.increase(product.name);
    await expect(cartPage.quantity(product.name)).toHaveText('2');
    await expect(cartPage.subtotal).toHaveText('Rs 5,000');
    await expect(cartPage.shipping).toHaveText('Free');
    await expect(cartPage.freeShippingHint).toBeHidden();
  });

  test('quantity cannot go above stock', async ({ customerPage, customer, cartPage, createProduct }) => {
    const product = await createProduct({ stock: 2 });
    await customer.api.addToCart(product.id, 2);
    await cartPage.goto();
    await expect(cartPage.item(product.name).getByTestId('cart-qty-increase')).toBeDisabled();
  });

  test('removing the last item shows the empty cart', async ({ customerPage, customer, cartPage, createProduct }) => {
    const product = await createProduct();
    await customer.api.addToCart(product.id, 1);
    await cartPage.goto();
    await cartPage.remove(product.name);
    await expect(cartPage.toast(`${product.name} removed from cart`)).toBeVisible();
    await expect(cartPage.empty).toBeVisible();
    await expect(cartPage.header.cartCount).toBeHidden();
  });
});
