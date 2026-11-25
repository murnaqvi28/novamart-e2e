const { BasePage } = require('./BasePage');
const { parsePrice } = require('../utils/price');

class CartPage extends BasePage {
  constructor(page) {
    super(page);
    this.items = page.getByTestId('cart-item');
    this.empty = page.getByTestId('cart-empty');
    this.freeShippingHint = page.getByTestId('free-shipping-hint');
    this.subtotal = page.getByTestId('summary-subtotal');
    this.shipping = page.getByTestId('summary-shipping');
    this.discount = page.getByTestId('summary-discount');
    this.total = page.getByTestId('summary-total');
    this.checkoutButton = page.getByTestId('checkout-button');
  }

  async goto() {
    await this.open('/cart');
    await this.items.first().or(this.empty).waitFor();
  }

  item(name) {
    return this.items.filter({ has: this.page.getByTestId('cart-item-name').filter({ hasText: name }) });
  }

  async increase(name) { await this.item(name).getByTestId('cart-qty-increase').click(); }
  async decrease(name) { await this.item(name).getByTestId('cart-qty-decrease').click(); }
  quantity(name) { return this.item(name).getByTestId('cart-qty-value'); }
  lineTotal(name) { return this.item(name).getByTestId('cart-item-total'); }
  async remove(name) { await this.item(name).getByTestId('cart-item-remove').click(); }

  async summary() {
    return {
      subtotal: parsePrice(await this.subtotal.innerText()),
      shippingFee: parsePrice(await this.shipping.innerText()),
      discount: (await this.discount.count()) ? parsePrice(await this.discount.innerText()) : 0,
      total: parsePrice(await this.total.innerText()),
    };
  }

  async proceedToCheckout() {
    await this.checkoutButton.click();
  }
}

module.exports = { CartPage };
