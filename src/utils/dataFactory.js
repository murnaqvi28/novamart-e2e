/** Generates unique, valid test data so tests never depend on each other. */

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const FIRST = ['Ali', 'Sara', 'Usman', 'Ayesha', 'Hamza', 'Fatima', 'Bilal', 'Zainab'];
const LAST = ['Khan', 'Raza', 'Ahmed', 'Malik', 'Qureshi', 'Naqvi', 'Siddiqui'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function newUser(overrides = {}) {
  const id = uid();
  return {
    name: `${pick(FIRST)} ${pick(LAST)}`,
    email: `e2e.${id}@example.com`,
    password: `Test${id.slice(0, 6)}1`,
    ...overrides,
  };
}

function shippingAddress(overrides = {}) {
  return {
    name: `${pick(FIRST)} ${pick(LAST)}`,
    phone: `0300${String(Math.floor(1000000 + Math.random() * 8999999))}`,
    address: `House ${Math.floor(Math.random() * 200) + 1}, Street ${Math.floor(Math.random() * 30) + 1}, Bahria Town`,
    city: 'Rawalpindi',
    postalCode: '46000',
    ...overrides,
  };
}

/** Product payload for the admin API. No category by default so it never skews category-based tests. */
function newProduct(overrides = {}) {
  return {
    name: `E2E Product ${uid()}`,
    description: 'Created by the automated test suite.',
    price: 1500,
    compareAtPrice: null,
    stock: 20,
    categoryId: null,
    imageUrl: null,
    isFeatured: false,
    isActive: true,
    ...overrides,
  };
}

module.exports = { uid, newUser, shippingAddress, newProduct };
