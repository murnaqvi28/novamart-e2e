const { BasePage } = require('./BasePage');

class HomePage extends BasePage {
  constructor(page) {
    super(page);
    this.shopNowButton = page.getByTestId('hero-shop-now');
    this.categoryList = page.getByTestId('category-list');
    this.featuredProducts = page.getByTestId('featured-products').getByTestId('product-card');
  }

  async goto() {
    await this.open('/');
  }

  category(slug) {
    return this.page.getByTestId(`category-${slug}`);
  }
}

module.exports = { HomePage };
