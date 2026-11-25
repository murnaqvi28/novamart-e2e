const { BasePage } = require('./BasePage');
const { parsePrice } = require('../utils/price');

class CheckoutPage extends BasePage {
  constructor(page) {
    super(page);
    this.root = page.getByTestId('checkout-page');
    this.formError = page.getByTestId('checkout-error');
    this.name = page.getByTestId('checkout-name');
    this.phone = page.getByTestId('checkout-phone');
    this.address = page.getByTestId('checkout-address');
    this.city = page.getByTestId('checkout-city');
    this.postalCode = page.getByTestId('checkout-postalCode');
    this.payCod = page.getByTestId('payment-cod');
    this.payCard = page.getByTestId('payment-card');
    this.cardNumber = page.getByTestId('checkout-card-number');
    this.cardExpiry = page.getByTestId('checkout-card-expiry');
    this.cardCvv = page.getByTestId('checkout-card-cvv');
    this.cardName = page.getByTestId('checkout-card-nameOnCard');
    this.couponInput = page.getByTestId('coupon-input');
    this.couponApply = page.getByTestId('coupon-apply');
    this.couponError = page.getByTestId('coupon-error');
    this.couponApplied = page.getByTestId('coupon-applied');
    this.couponRemove = page.getByTestId('coupon-remove');
    this.subtotal = page.getByTestId('summary-subtotal');
    this.discount = page.getByTestId('summary-discount');
    this.shipping = page.getByTestId('summary-shipping');
    this.total = page.getByTestId('summary-total');
    this.placeOrderButton = page.getByTestId('place-order');
  }

  async goto() {
    await this.open('/checkout');
    await this.root.waitFor();
  }

  /** Field-level validation message, e.g. fieldError('phone'), fieldError('card-number') */
  fieldError(field) {
    return this.page.getByTestId(`error-${field}`);
  }

  async fillShipping({ name, phone, address, city, postalCode }) {
    if (name !== undefined) await this.name.fill(name);
    if (phone !== undefined) await this.phone.fill(phone);
    if (address !== undefined) await this.address.fill(address);
    if (city !== undefined) await this.city.selectOption(city);
    if (postalCode !== undefined) await this.postalCode.fill(postalCode);
  }

  async payWithCard({ number, expiry, cvv, nameOnCard }) {
    await this.payCard.check();
    await this.cardNumber.fill(number);
    await this.cardExpiry.fill(expiry.replace('/', ''));
    await this.cardCvv.fill(cvv);
    await this.cardName.fill(nameOnCard);
  }

  async payCashOnDelivery() {
    await this.payCod.check();
  }

  async applyCoupon(code) {
    await this.couponInput.fill(code);
    await this.couponApply.click();
    await this.couponApplied.or(this.couponError).waitFor();
  }

  async placeOrder() {
    await this.placeOrderButton.click();
  }

  async summary() {
    return {
      subtotal: parsePrice(await this.subtotal.innerText()),
      shippingFee: parsePrice(await this.shipping.innerText()),
      discount: (await this.discount.count()) ? parsePrice(await this.discount.innerText()) : 0,
      total: parsePrice(await this.total.innerText()),
    };
  }
}

module.exports = { CheckoutPage };
