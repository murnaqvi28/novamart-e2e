const base = require('@playwright/test');
const { NovaMartApi } = require('../api/NovaMartApi');
const { USERS } = require('../data/testData');
const { newUser, newProduct, shippingAddress } = require('../utils/dataFactory');
const { getValidator } = require('../utils/schemaValidator');
const { HomePage } = require('../pages/HomePage');
const { ShopPage } = require('../pages/ShopPage');
const { ProductPage } = require('../pages/ProductPage');
const { CartPage } = require('../pages/CartPage');
const { CheckoutPage } = require('../pages/CheckoutPage');
const { OrderDetailPage } = require('../pages/OrderDetailPage');
const { OrdersPage } = require('../pages/OrdersPage');
const { LoginPage } = require('../pages/LoginPage');
const { RegisterPage } = require('../pages/RegisterPage');
const { AdminProductsPage } = require('../pages/admin/AdminProductsPage');
const { AdminOrdersPage } = require('../pages/admin/AdminOrdersPage');

const TOKEN_KEY = 'novamart_token';

/**
 * Logs the browser in by placing a JWT in localStorage before the app boots.
 * Only applied on the first load of the tab, so UI logout still works afterwards.
 */
async function authenticate(page, token) {
  await page.addInitScript(([key, t]) => {
    if (!sessionStorage.getItem('__e2e_auth_done')) {
      localStorage.setItem(key, t);
      sessionStorage.setItem('__e2e_auth_done', '1');
    }
  }, [TOKEN_KEY, token]);
}

const test = base.test.extend({
  // ---------- API clients ----------
  /** Anonymous API client */
  api: async ({ request }, use) => {
    await use(new NovaMartApi(request));
  },

  /** API client logged in as the seeded admin */
  adminApi: async ({ request }, use) => {
    const { api } = await new NovaMartApi(request).loginAs(USERS.admin.email, USERS.admin.password);
    await use(api);
  },

  /** A brand-new customer registered for this test only (isolated cart and orders) */
  customer: async ({ request }, use) => {
    const data = newUser();
    const res = await new NovaMartApi(request).register(data);
    if (res.status() !== 201) throw new Error(`Could not register test user: ${res.status()} ${await res.text()}`);
    const body = await res.json();
    await use({ ...data, id: body.user.id, token: body.token, api: new NovaMartApi(request, body.token) });
  },

  // ---------- Test data builders ----------
  /**
   * Creates products through the admin API and deactivates them after the test.
   * Usage: const p = await createProduct({ price: 2000, stock: 3 })
   */
  createProduct: async ({ adminApi }, use) => {
    const created = [];
    await use(async (overrides = {}) => {
      const res = await adminApi.createProduct(newProduct(overrides));
      if (res.status() !== 201) throw new Error(`Could not create product: ${res.status()} ${await res.text()}`);
      const { data } = await res.json();
      created.push(data.id);
      return data;
    });
    for (const id of created) await adminApi.deactivateProduct(id);
  },

  /**
   * Places an order for a customer through the API.
   * Usage: const order = await placeOrder(customer, [{ product, quantity: 2 }], { paymentMethod: 'cod' })
   */
  placeOrder: async ({}, use) => {
    await use(async (customer, items, { paymentMethod = 'cod', card, couponCode = null, shipping } = {}) => {
      for (const { product, quantity = 1 } of items) {
        const r = await customer.api.addToCart(product.id, quantity);
        if (!r.ok()) throw new Error(`Add to cart failed: ${r.status()} ${await r.text()}`);
      }
      const res = await customer.api.placeOrder({ shipping: shipping || shippingAddress(), paymentMethod, card, couponCode });
      if (res.status() !== 201) throw new Error(`Place order failed: ${res.status()} ${await res.text()}`);
      return (await res.json()).data;
    });
  },

  /** OpenAPI response validator built from the app's live spec */
  schema: async ({ request }, use) => {
    await use(await getValidator(request));
  },

  // ---------- Browser helpers ----------
  /** Call to log the browser in as a given token before navigating */
  loginWithToken: async ({ page }, use) => {
    await use((token) => authenticate(page, token));
  },

  /** Page already logged in as a fresh customer. Also exposes the customer via `customer` fixture. */
  customerPage: async ({ page, customer }, use) => {
    await authenticate(page, customer.token);
    await use(page);
  },

  /** Page already logged in as the seeded admin */
  adminPage: async ({ page, request }, use) => {
    const { token } = await new NovaMartApi(request).loginAs(USERS.admin.email, USERS.admin.password);
    await authenticate(page, token);
    await use(page);
  },

  // ---------- Page objects ----------
  homePage: async ({ page }, use) => use(new HomePage(page)),
  shopPage: async ({ page }, use) => use(new ShopPage(page)),
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
  orderDetailPage: async ({ page }, use) => use(new OrderDetailPage(page)),
  ordersPage: async ({ page }, use) => use(new OrdersPage(page)),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  registerPage: async ({ page }, use) => use(new RegisterPage(page)),
  adminProductsPage: async ({ page }, use) => use(new AdminProductsPage(page)),
  adminOrdersPage: async ({ page }, use) => use(new AdminOrdersPage(page)),
});

module.exports = { test, expect: base.expect };
