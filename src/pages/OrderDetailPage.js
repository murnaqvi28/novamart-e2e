const { BasePage } = require('./BasePage');
const { parsePrice } = require('../utils/price');

class OrderDetailPage extends BasePage {
  constructor(page) {
    super(page);
    this.root = page.getByTestId('order-detail-page');
    this.successBanner = page.getByTestId('order-success');
    this.successOrderNumber = page.getByTestId('success-order-number');
    this.orderNumber = page.locator('.order-head').getByTestId('order-number');
    this.status = page.locator('.order-head').getByTestId('order-status');
    this.items = page.getByTestId('order-item');
    this.timeline = page.getByTestId('order-timeline');
    this.payment = page.getByTestId('order-payment');
    this.shipping = page.getByTestId('order-shipping');
    this.total = page.getByTestId('summary-total');
    this.cancelButton = page.getByTestId('cancel-order');
    this.notFound = page.getByTestId('order-not-found');
  }

  async goto(id) {
    await this.open(`/orders/${id}`);
    await this.root.or(this.notFound).waitFor();
  }

  /** Order id taken from the URL, e.g. /orders/42?placed=1 -> 42 */
  orderId() {
    return Number(new URL(this.page.url()).pathname.split('/').pop());
  }

  async totalValue() {
    return parsePrice(await this.total.innerText());
  }

  async cancel() {
    this.acceptNextDialog();
    await this.cancelButton.click();
  }
}

module.exports = { OrderDetailPage };
