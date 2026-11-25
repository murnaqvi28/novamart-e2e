class Header {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.logo = page.getByTestId('logo');
    this.searchInput = page.getByTestId('search-input');
    this.searchButton = page.getByTestId('search-button');
    this.cartLink = page.getByTestId('nav-cart');
    this.cartCount = page.getByTestId('cart-count');
    this.loginLink = page.getByTestId('nav-login');
    this.accountMenu = page.getByTestId('account-menu');
    this.userName = page.getByTestId('user-name');
    this.ordersLink = page.getByTestId('nav-orders');
    this.adminLink = page.getByTestId('nav-admin');
    this.logoutButton = page.getByTestId('logout-button');
  }

  async search(term) {
    await this.searchInput.fill(term);
    await this.searchButton.click();
  }

  async openCart() {
    await this.cartLink.click();
  }

  async openMyOrders() {
    await this.accountMenu.click();
    await this.ordersLink.click();
  }

  async logout() {
    await this.accountMenu.click();
    await this.logoutButton.click();
  }
}

module.exports = { Header };
