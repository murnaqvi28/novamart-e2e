const { Header } = require('./Header');

class BasePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.header = new Header(page);
    this.toastSuccess = page.getByTestId('toast-success');
    this.toastError = page.getByTestId('toast-error');
    this.loading = page.getByTestId('loading');
  }

  /** A success/error toast containing the given text (several toasts can be on screen at once). */
  toast(text, type = 'success') {
    return this.page.getByTestId(`toast-${type}`).filter({ hasText: text });
  }

  async open(path) {
    await this.page.goto(path);
  }

  /** Accepts the next native confirm() dialog (used for destructive actions). */
  acceptNextDialog() {
    this.page.once('dialog', (d) => d.accept());
  }
}

module.exports = { BasePage };
