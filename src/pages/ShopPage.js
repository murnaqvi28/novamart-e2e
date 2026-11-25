const { BasePage } = require('./BasePage');
const { parsePrice } = require('../utils/price');

class ShopPage extends BasePage {
  constructor(page) {
    super(page);
    this.title = page.getByTestId('shop-title');
    this.resultCount = page.getByTestId('result-count');
    this.grid = page.getByTestId('product-grid');
    this.productCards = page.getByTestId('product-grid').getByTestId('product-card');
    this.noResults = page.getByTestId('no-results');
    this.sortSelect = page.getByTestId('sort-select');
    this.minPrice = page.getByTestId('filter-min-price');
    this.maxPrice = page.getByTestId('filter-max-price');
    this.applyPrice = page.getByTestId('filter-price-apply');
    this.inStockOnly = page.getByTestId('filter-in-stock');
    this.clearFilters = page.getByTestId('clear-filters');
    this.pagination = page.getByTestId('pagination');
    this.nextPage = page.getByTestId('page-next');
    this.prevPage = page.getByTestId('page-prev');
  }

  /** @param {Record<string,string|number>} [params] query string filters */
  async goto(params = {}) {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    await this.withProductsReload(() => this.open(`/shop${qs ? `?${qs}` : ''}`));
  }

  /**
   * Runs an action that changes the listing and waits until the NEW results are on screen.
   * Waiting only for the URL is not enough: the old grid is still visible until the API answers,
   * which made assertions read stale products on slower (deployed) environments.
   */
  async withProductsReload(action) {
    const response = this.page.waitForResponse((r) => /\/api\/products\?/.test(r.url()) && r.request().method() === 'GET');
    await action();
    await response;
    await this.waitForResults();
  }

  /** Waits until either the grid or the empty state is rendered. */
  async waitForResults() {
    await this.productCards.first().or(this.noResults).waitFor();
  }

  async sortBy(value) {
    await this.withProductsReload(() => this.sortSelect.selectOption(value));
  }

  async filterByCategory(slug) {
    await this.withProductsReload(() => this.page.getByTestId(`filter-category-${slug}`).click());
  }

  async filterByPrice(min, max) {
    await this.minPrice.fill(String(min));
    await this.maxPrice.fill(String(max));
    await this.withProductsReload(() => this.applyPrice.click());
  }

  async goToPage(n) {
    await this.withProductsReload(() => this.page.getByTestId(`page-${n}`).click());
  }

  async goToNextPage() {
    await this.withProductsReload(() => this.nextPage.click());
  }

  async productNames() {
    return this.productCards.getByTestId('product-name').allInnerTexts();
  }

  async productPrices() {
    const texts = await this.productCards.getByTestId('product-price').allInnerTexts();
    return texts.map(parsePrice);
  }

  async totalCount() {
    return parseInt(await this.resultCount.innerText(), 10);
  }

  async openProduct(name) {
    await this.productCards.filter({ hasText: name }).first().click();
  }
}

module.exports = { ShopPage };
