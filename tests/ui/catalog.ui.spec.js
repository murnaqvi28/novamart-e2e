const { test, expect } = require('../../src/fixtures');

test.describe('Catalog UI', () => {
  test('home page shows categories and featured products @smoke @mobile', async ({ homePage, api }) => {
    const { data: featured } = await (await api.products({ featured: 'true', limit: 8 })).json();
    await homePage.goto();
    await expect(homePage.featuredProducts).toHaveCount(featured.length);
    await expect(homePage.category('electronics')).toBeVisible();
  });

  test('search from the header shows matching products @mobile', async ({ homePage, shopPage, page }) => {
    await homePage.goto();
    await shopPage.withProductsReload(() => homePage.header.search('lamp'));
    await expect(page).toHaveURL('/shop?search=lamp');
    await expect(shopPage.title).toHaveText('Results for “lamp”');
    for (const name of await shopPage.productNames()) expect(name.toLowerCase()).toContain('lamp');
  });

  test('shows an empty state when nothing matches', async ({ shopPage }) => {
    await shopPage.goto({ search: 'no-such-thing-xyz' });
    await expect(shopPage.noResults).toBeVisible();
    await expect(shopPage.resultCount).toHaveText('0 products');
  });

  test('category filter matches the API count', async ({ shopPage, api }) => {
    const { pagination } = await (await api.products({ category: 'fashion' })).json();
    await shopPage.goto();
    await shopPage.filterByCategory('fashion');
    await expect(shopPage.title).toHaveText('Fashion');
    await expect(shopPage.resultCount).toHaveText(`${pagination.total} products`);
  });

  test('sorting by price low to high orders the grid', async ({ shopPage }) => {
    await shopPage.goto();
    await shopPage.sortBy('price_asc');
    const prices = await shopPage.productPrices();
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test('price range filter only shows products within range', async ({ shopPage }) => {
    await shopPage.goto();
    await shopPage.filterByPrice(2000, 4000);
    const prices = await shopPage.productPrices();
    expect(prices.length).toBeGreaterThan(0);
    for (const p of prices) expect(p >= 2000 && p <= 4000, `price ${p}`).toBe(true);
  });

  test('pagination moves to the next page and keeps filters in the URL', async ({ shopPage, page }) => {
    // Seeded category + small page size keeps this stable while other tests add products
    await shopPage.goto({ category: 'electronics', sort: 'price_desc', limit: 3 });
    const firstPage = await shopPage.productNames();
    await shopPage.goToNextPage();
    await expect(page).toHaveURL(/sort=price_desc/);
    await expect(page).toHaveURL(/page=2/);
    const secondPage = await shopPage.productNames();
    expect(secondPage.some((n) => firstPage.includes(n))).toBe(false);
  });

  test('product page shows the same details as the API', async ({ productPage, api }) => {
    const { data } = await (await api.product('aero-wireless-headphones')).json();
    await productPage.goto(data.slug);
    await expect(productPage.title).toHaveText(data.name);
    expect(await productPage.priceValue()).toBe(data.price);
    await expect(productPage.description).toHaveText(data.description);
    await expect(productPage.relatedProducts.first()).toBeVisible();
  });

  test('sold-out product cannot be added to cart', async ({ productPage, createProduct }) => {
    const product = await createProduct({ stock: 0 });
    await productPage.goto(product.slug);
    await expect(productPage.stockStatus).toHaveText('Out of stock');
    await expect(productPage.addToCartButton).toHaveCount(0);
  });

  test('low stock warning and quantity limit', async ({ productPage, createProduct }) => {
    const product = await createProduct({ stock: 3 });
    await productPage.goto(product.slug);
    await expect(productPage.stockStatus).toHaveText('Only 3 left in stock');
    await productPage.setQuantity(3);
    await expect(productPage.qtyIncrease).toBeDisabled();
  });

  test('shows a not-found page for unknown products', async ({ productPage }) => {
    await productPage.goto('does-not-exist');
    await expect(productPage.notFound).toBeVisible();
  });

  test('unknown routes show the 404 page', async ({ page }) => {
    await page.goto('/this/page/does/not/exist');
    await expect(page.getByTestId('not-found-page')).toBeVisible();
  });

  test('logged-in customer can write a review', async ({ customerPage, productPage, createProduct }) => {
    const product = await createProduct();
    await productPage.goto(product.slug);
    await expect(productPage.page.getByTestId('no-reviews')).toBeVisible();
    await productPage.submitReview(5, 'Excellent quality, would buy again');
    await expect(productPage.reviewItems).toHaveCount(1);
    await expect(productPage.reviewItems.first()).toContainText('Excellent quality');
  });
});
