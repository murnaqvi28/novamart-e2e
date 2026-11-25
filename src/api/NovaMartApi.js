/**
 * Thin client for the NovaMart REST API.
 * Every method returns Playwright's APIResponse so tests can assert on status, headers and body.
 */
class NovaMartApi {
  /**
   * @param {import('@playwright/test').APIRequestContext} request
   * @param {string} [token]
   */
  constructor(request, token) {
    this.request = request;
    this.token = token;
  }

  withToken(token) {
    return new NovaMartApi(this.request, token);
  }

  headers(extra = {}) {
    return this.token ? { Authorization: `Bearer ${this.token}`, ...extra } : extra;
  }

  get(path, params) { return this.request.get(`/api${path}`, { headers: this.headers(), params }); }
  post(path, data) { return this.request.post(`/api${path}`, { headers: this.headers(), data }); }
  put(path, data) { return this.request.put(`/api${path}`, { headers: this.headers(), data }); }
  patch(path, data) { return this.request.patch(`/api${path}`, { headers: this.headers(), data }); }
  delete(path) { return this.request.delete(`/api${path}`, { headers: this.headers() }); }

  // ---- System
  health() { return this.get('/health'); }
  config() { return this.get('/config'); }

  // ---- Auth
  register(user) { return this.post('/auth/register', user); }
  login(email, password) { return this.post('/auth/login', { email, password }); }
  me() { return this.get('/auth/me'); }

  /** Logs in and returns a new client carrying the token. */
  async loginAs(email, password) {
    const res = await this.login(email, password);
    if (!res.ok()) throw new Error(`Login failed for ${email}: HTTP ${res.status()} ${await res.text()}`);
    const body = await res.json();
    return { api: this.withToken(body.token), token: body.token, user: body.user };
  }

  // ---- Catalog
  categories() { return this.get('/categories'); }
  products(params) { return this.get('/products', params); }
  product(idOrSlug) { return this.get(`/products/${idOrSlug}`); }
  reviews(idOrSlug) { return this.get(`/products/${idOrSlug}/reviews`); }
  addReview(idOrSlug, review) { return this.post(`/products/${idOrSlug}/reviews`, review); }

  // ---- Cart
  cart(coupon) { return this.get('/cart', coupon ? { coupon } : undefined); }
  addToCart(productId, quantity = 1) { return this.post('/cart/items', { productId, quantity }); }
  updateCartItem(productId, quantity) { return this.patch(`/cart/items/${productId}`, { quantity }); }
  removeCartItem(productId) { return this.delete(`/cart/items/${productId}`); }
  clearCart() { return this.delete('/cart'); }
  applyCoupon(code) { return this.post('/cart/coupon', { code }); }

  // ---- Orders
  placeOrder(payload) { return this.post('/orders', payload); }
  orders() { return this.get('/orders'); }
  order(id) { return this.get(`/orders/${id}`); }
  cancelOrder(id) { return this.post(`/orders/${id}/cancel`); }

  // ---- Admin
  adminStats() { return this.get('/admin/stats'); }
  adminProducts(search) { return this.get('/admin/products', search ? { search } : undefined); }
  createProduct(product) { return this.post('/admin/products', product); }
  updateProduct(id, product) { return this.put(`/admin/products/${id}`, product); }
  deactivateProduct(id) { return this.delete(`/admin/products/${id}`); }
  adminOrders(status) { return this.get('/admin/orders', status ? { status } : undefined); }
  adminOrder(id) { return this.get(`/admin/orders/${id}`); }
  updateOrderStatus(id, status) { return this.patch(`/admin/orders/${id}/status`, { status }); }
  adminUsers() { return this.get('/admin/users'); }
}

module.exports = { NovaMartApi };
