const { BasePage } = require('../BasePage');

class AdminOrdersPage extends BasePage {
  constructor(page) {
    super(page);
    this.root = page.getByTestId('admin-orders');
    this.rows = page.getByTestId('admin-order-row');
    this.empty = page.getByTestId('admin-orders-empty');
    this.modal = page.getByTestId('admin-order-modal');
  }

  async goto() {
    await this.open('/admin/orders');
    await this.rows.first().or(this.empty).waitFor();
  }

  row(orderNumber) {
    return this.page.locator(`[data-testid="admin-order-row"][data-order-number="${orderNumber}"]`);
  }

  async filterByStatus(status) {
    await this.page.getByTestId(`order-filter-${status || 'all'}`).click();
    await this.rows.first().or(this.empty).waitFor();
  }

  async changeStatus(orderNumber, status) {
    await this.row(orderNumber).getByTestId('admin-order-status-select').selectOption(status);
  }

  async availableTransitions(orderNumber) {
    const select = this.row(orderNumber).getByTestId('admin-order-status-select');
    if (!(await select.count())) return [];
    const values = await select.locator('option').evaluateAll((opts) => opts.map((o) => o.value));
    return values.filter(Boolean);
  }
}

module.exports = { AdminOrdersPage };
