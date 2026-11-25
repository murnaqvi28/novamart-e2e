const { BasePage } = require('./BasePage');
const { parsePrice } = require('../utils/price');

class ProductPage extends BasePage {
  constructor(page) {
    super(page);
    this.title = page.getByTestId('product-title');
    // Scoped to the main product panel so related-product cards don't match
    this.info = page.locator('.pdp__info');
    this.price = this.info.getByTestId('product-price');
    this.comparePrice = this.info.getByTestId('product-compare-price');
    this.description = page.getByTestId('product-description');
    this.stockStatus = page.getByTestId('stock-status');
    this.addToCartButton = page.getByTestId('add-to-cart');
    this.qtyIncrease = page.getByTestId('qty-increase');
    this.qtyDecrease = page.getByTestId('qty-decrease');
    this.qtyValue = page.getByTestId('qty-value');
    this.notFound = page.getByTestId('product-not-found');
    this.reviewRating = page.getByTestId('review-rating');
    this.reviewComment = page.getByTestId('review-comment');
    this.reviewSubmit = page.getByTestId('review-submit');
    this.reviewError = page.getByTestId('review-error');
    this.reviewItems = page.getByTestId('review-item');
    this.relatedProducts = page.getByTestId('related-products').getByTestId('product-card');
  }

  async goto(slug) {
    await this.open(`/product/${slug}`);
    await this.title.or(this.notFound).waitFor();
  }

  async priceValue() {
    return parsePrice(await this.price.innerText());
  }

  async setQuantity(qty) {
    let current = parseInt(await this.qtyValue.innerText(), 10);
    while (current < qty) { await this.qtyIncrease.click(); current += 1; }
    while (current > qty) { await this.qtyDecrease.click(); current -= 1; }
  }

  async addToCart(qty = 1) {
    if (qty > 1) await this.setQuantity(qty);
    await this.addToCartButton.click();
  }

  async submitReview(rating, comment) {
    await this.reviewRating.selectOption(String(rating));
    await this.reviewComment.fill(comment);
    await this.reviewSubmit.click();
  }
}

module.exports = { ProductPage };
