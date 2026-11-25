/** Static test data that mirrors the app's documented business rules. */

const USERS = {
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@novamart.pk',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  },
  customer: {
    email: process.env.CUSTOMER_EMAIL || 'ali@example.com',
    password: process.env.CUSTOMER_PASSWORD || 'Customer@123',
  },
};

const RULES = {
  currency: 'PKR',
  freeShippingThreshold: 5000,
  shippingFee: 250,
};

const CARDS = {
  success: { number: '4242424242424242', expiry: '12/30', cvv: '123', nameOnCard: 'Ali Raza' },
  declined: { number: '4000000000000002', expiry: '12/30', cvv: '123', nameOnCard: 'Ali Raza' },
  insufficientFunds: { number: '4000000000009995', expiry: '12/30', cvv: '123', nameOnCard: 'Ali Raza' },
  invalidLuhn: { number: '4242424242424241', expiry: '12/30', cvv: '123', nameOnCard: 'Ali Raza' },
  expired: { number: '4242424242424242', expiry: '01/20', cvv: '123', nameOnCard: 'Ali Raza' },
};

const COUPONS = {
  percent10: { code: 'WELCOME10', type: 'percent', value: 10, minSubtotal: 2000 },
  flat500: { code: 'FLAT500', type: 'fixed', value: 500, minSubtotal: 3000 },
  expired: { code: 'EXPIRED20' },
  inactive: { code: 'INACTIVE15' },
};

const MESSAGES = {
  invalidLogin: 'Invalid email or password',
  duplicateEmail: 'An account with this email already exists',
  couponExpired: 'This coupon has expired',
  couponInvalid: 'Invalid coupon code',
  cardDeclined: 'Your card was declined',
  insufficientFunds: 'Insufficient funds on card',
  outOfStock: 'This product is out of stock',
  adminRequired: 'Admin access required',
  emptyCart: 'Your cart is empty',
  onlyNInStock: (n) => `Only ${n} item(s) available in stock`,
  couponMinimum: (min) => `Minimum order of PKR ${min} required for this coupon`,
};

const ORDER_STATUS = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

module.exports = { USERS, RULES, CARDS, COUPONS, MESSAGES, ORDER_STATUS };
