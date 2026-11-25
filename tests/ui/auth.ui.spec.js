const { test, expect } = require('../../src/fixtures');
const { newUser } = require('../../src/utils/dataFactory');
const { USERS, MESSAGES } = require('../../src/data/testData');

test.describe('Authentication UI', () => {
  test('new visitor can register and is logged in @smoke @mobile', async ({ page, registerPage }) => {
    const user = newUser();
    await registerPage.goto();
    await registerPage.register(user);

    await expect(page).toHaveURL('/');
    await expect(registerPage.toast('Account created')).toBeVisible();
    await registerPage.header.accountMenu.click();
    await expect(page.getByTestId('account-dropdown')).toContainText(user.email);
  });

  test('shows an error when passwords do not match', async ({ registerPage }) => {
    await registerPage.goto();
    await registerPage.register({ ...newUser(), confirm: 'Different123' });
    await expect(registerPage.fieldError('confirm')).toHaveText('Passwords do not match');
  });

  test('shows server-side validation for a weak password', async ({ registerPage }) => {
    await registerPage.goto();
    await registerPage.register(newUser({ password: 'abcdefgh' }));
    await expect(registerPage.fieldError('password')).toHaveText('Password must contain a number');
  });

  test('shows an error for an email that is already registered', async ({ registerPage, customer }) => {
    await registerPage.goto();
    await registerPage.register(newUser({ email: customer.email }));
    await expect(registerPage.error).toHaveText(MESSAGES.duplicateEmail);
  });

  test('rejects invalid credentials', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.login(USERS.customer.email, 'WrongPassword1');
    await expect(loginPage.error).toHaveText(MESSAGES.invalidLogin);
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects to the requested page after login', async ({ page, loginPage, customer }) => {
    await page.goto('/orders');
    await expect(page).toHaveURL('/login?redirect=%2Forders');
    await loginPage.login(customer.email, customer.password);
    await expect(page).toHaveURL('/orders');
    await expect(page.getByTestId('orders-empty')).toBeVisible();
  });

  test('user can log out', async ({ page, loginPage, customer }) => {
    await loginPage.goto();
    await loginPage.login(customer.email, customer.password);
    await expect(loginPage.header.userName).toHaveText(customer.name.split(' ')[0]);
    await loginPage.header.logout();
    await expect(loginPage.header.loginLink).toBeVisible();
    await page.goto('/cart');
    await expect(page).toHaveURL(/\/login\?redirect=/);
  });

  test('protected pages redirect guests to login', async ({ page }) => {
    for (const path of ['/cart', '/checkout', '/orders', '/admin']) {
      await page.goto(path);
      await expect(page, path).toHaveURL(`/login?redirect=${encodeURIComponent(path)}`);
    }
  });
});
