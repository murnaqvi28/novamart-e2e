const { BasePage } = require('./BasePage');

class OrdersPage extends BasePage {
  constructor(page) {
    super(page);
    this.rows = page.getByTestId('order-row');
    this.empty = page.getByTestId('orders-empty');
  }

  async goto() {
    await this.open('/orders');
    await this.rows.first().or(this.empty).waitFor();
  }

  row(orderNumber) {
    return this.page.locator(`[data-testid="order-row"][data-order-number="${orderNumber}"]`);
  }
}

module.exports = { OrdersPage };
