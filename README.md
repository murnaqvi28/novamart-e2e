# NovaMart E2E — Playwright + JavaScript

End-to-end test automation for **[NovaMart](https://novamart-ot9u.onrender.com)**, a full-stack e-commerce store (React + Express + PostgreSQL).

The suite covers the UI, the REST API, and the API contract (OpenAPI schema), and runs in GitHub Actions on every push and every morning.

| | |
|---|---|
| Framework | Playwright Test (JavaScript, CommonJS) |
| Pattern | Page Object Model + custom fixtures |
| Layers | UI (desktop + mobile), REST API, contract (Ajv + OpenAPI) |
| Test data | Created per test through the API, so tests are independent and run in parallel |
| Reporting | HTML report, traces, screenshots and videos on failure |
| CI | GitHub Actions: push, pull request, daily schedule, manual run with suite selection |

---

## Quick start

```bash
npm ci
npx playwright install chromium
cp .env.example .env        # BASE_URL defaults to the live site
npm test                    # run everything
npm run report              # open the HTML report
```

| Command | What it runs |
|---|---|
| `npm test` | All projects (API + desktop Chrome + mobile) |
| `npm run test:api` | API and contract tests only |
| `npm run test:ui` | UI and end-to-end tests in desktop Chrome |
| `npm run test:mobile` | Tests tagged `@mobile` on a Pixel 7 viewport |
| `npm run test:smoke` | Tests tagged `@smoke` (critical paths) |
| `npm run test:headed` | UI tests in a visible browser |
| `npm run test:debug` | Step through UI tests with the Playwright Inspector |

Run one file or one test:
```bash
npx playwright test tests/ui/checkout.ui.spec.js
npx playwright test -g "applies a valid coupon"
```

---

## Configuration (`.env`)

| Variable | Purpose |
|---|---|
| `BASE_URL` | Site under test. Defaults to `https://novamart-ot9u.onrender.com` |
| `TEST_RESET_KEY` | Optional. When set, the database is reset to seed data once before the run (Render → service → Environment) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seeded admin account |
| `CUSTOMER_EMAIL` / `CUSTOMER_PASSWORD` | Seeded customer account |
| `VIDEO` | Override video recording (`off`, `on`, `retain-on-failure`) |
| `CHROMIUM_PATH` | Optional path to a locally installed Chromium |

`global-setup.js` waits up to 2 minutes for `/api/health`, because free hosting can take about a minute to wake up.

---

## Project structure

```
novamart-e2e/
├── playwright.config.js        # projects: api, chromium, mobile
├── global-setup.js             # health check + optional DB reset
├── src/
│   ├── api/NovaMartApi.js      # API client used by API tests and for test setup
│   ├── pages/                  # Page Objects (Header, Shop, Product, Cart, Checkout, Orders, Admin, ...)
│   ├── fixtures/index.js       # custom fixtures: customer, adminApi, createProduct, placeOrder, customerPage, ...
│   ├── data/testData.js        # cards, coupons, business rules, expected messages
│   └── utils/
│       ├── dataFactory.js      # unique users, products, addresses
│       ├── price.js            # price parsing + pricing oracle (expectedTotals)
│       └── schemaValidator.js  # OpenAPI → Ajv response validation
├── tests/
│   ├── api/                    # auth, catalog, cart + coupons, orders, admin, contract
│   ├── ui/                     # auth, catalog, cart, checkout, orders, admin
│   └── e2e/                    # full purchase journey (UI + API checkpoints)
└── .github/workflows/e2e.yml
```

---

## Design decisions

**Every test owns its data.** The `customer` fixture registers a brand-new user, and `createProduct` creates products through the admin API and deactivates them after the test. Tests never share a cart, an order, or a stock count, so they run fully parallel against a shared live environment.

**UI tests start in the right state.** Fixtures such as `customerPage` and `adminPage` log the browser in by placing the JWT in `localStorage` before the app loads. Cart contents are set up through the API. Only the behaviour under test is driven through the UI. Login and registration themselves are still tested through the UI in `auth.ui.spec.js`.

**One pricing oracle.** `expectedTotals()` in `src/utils/price.js` encodes the business rules: delivery Rs 250, free from Rs 5,000, percent and fixed coupons. API, UI and E2E tests all assert against it.

**UI is verified against the backend.** Key UI tests check the API afterwards, for example that the order total, status, coupon and stock reduction were actually saved.

**Contract tests use the app's own spec.** `schemaValidator.js` downloads `/api-docs/openapi.json`, converts OpenAPI `nullable` to JSON Schema, and validates real responses with Ajv. A response that drifts from the documented contract fails the build.

**Stable locators.** All selectors use `data-testid` (`testIdAttribute` is set in the config). Rows are found by business keys such as `data-order-number`.

---

## Fixtures reference

| Fixture | Gives you |
|---|---|
| `api` | Anonymous API client |
| `adminApi` | API client logged in as admin |
| `customer` | `{ name, email, password, id, token, api }` for a fresh, isolated user |
| `createProduct(overrides)` | Creates a product (auto-cleaned up) and returns it |
| `placeOrder(customer, [{ product, quantity }], { paymentMethod, card, couponCode })` | Places an order through the API |
| `schema` | `schema.validate('Order', body)` returns a list of schema errors |
| `customerPage` / `adminPage` | `page` already logged in |
| `homePage`, `shopPage`, `productPage`, `cartPage`, `checkoutPage`, `orderDetailPage`, `ordersPage`, `loginPage`, `registerPage`, `adminProductsPage`, `adminOrdersPage` | Page Objects |

Example:
```js
test('free delivery from Rs 5,000', async ({ customerPage, customer, createProduct, cartPage }) => {
  const product = await createProduct({ price: 2500 });
  await customer.api.addToCart(product.id, 2);
  await cartPage.goto();
  await expect(cartPage.shipping).toHaveText('Free');
});
```

---

## Coverage

| Area | Examples |
|---|---|
| Auth | register, validation rules, duplicate email, login, wrong password, token checks, redirect after login, logout, protected routes |
| Catalog | search, category and price filters, sorting, pagination, invalid queries, product details, sold-out and low-stock states, reviews, 404s |
| Cart | add, merge quantities, stock limits, update, remove, clear, totals, free-delivery threshold, cart isolation |
| Coupons | percent, fixed, case-insensitive, minimum subtotal, expired, inactive, unknown |
| Checkout & orders | COD vs card, declined and insufficient-funds cards, field validation, phone formats, expired card, stock re-check, order history, cancel and stock restore, access control |
| Admin | role-based access (401/403), product CRUD and validation, order status state machine (allowed and forbidden transitions), filters, dashboard |
| Contract | Product, Category, AuthResponse, Cart, Order and Error schemas; documented routes exist |
| E2E journey | register → search → product → cart → coupon → card checkout → backend verification → order history → admin ships → customer sees update |

---

## CI (GitHub Actions)

`.github/workflows/e2e.yml` runs on push to `main`, on pull requests, every day at 08:00 PKT, and manually (**Actions → E2E tests → Run workflow**, choose `all`, `smoke`, `api`, `ui` or `mobile`).

Optional repository settings (**Settings → Secrets and variables → Actions**):
- Variable `BASE_URL`, to test another environment
- Secret `TEST_RESET_KEY`, to reset data before each run

The HTML report is uploaded as an artifact on every run, and traces are uploaded when tests fail.

---

## Bug found by this suite

**Opening `/checkout` directly (refresh or bookmarked link) bounced the user to the cart even when the cart had items.** The checkout page decided the cart was empty before the cart had loaded. Caught by the checkout UI tests and fixed in the app: the cart context now exposes a `loaded` flag and checkout waits for it.
