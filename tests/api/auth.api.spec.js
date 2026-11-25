const { test, expect } = require('../../src/fixtures');
const { newUser } = require('../../src/utils/dataFactory');
const { USERS, MESSAGES } = require('../../src/data/testData');

test.describe('Auth API', () => {
  test('registers a new customer and returns a token @smoke', async ({ api }) => {
    const user = newUser();
    const res = await api.register(user);

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.user).toMatchObject({ name: user.name, email: user.email, role: 'customer' });
    expect(body.user).not.toHaveProperty('password');
    expect(body.user).not.toHaveProperty('password_hash');
  });

  test('stores email in lower case and trims the name', async ({ api }) => {
    const user = newUser();
    const res = await api.register({ ...user, name: `  ${user.name}  `, email: user.email.toUpperCase() });
    const body = await res.json();
    expect(body.user.email).toBe(user.email.toLowerCase());
    expect(body.user.name).toBe(user.name);
  });

  test('rejects a duplicate email with 409', async ({ api, customer }) => {
    const res = await api.register(newUser({ email: customer.email }));
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toMatchObject({ code: 'CONFLICT', message: MESSAGES.duplicateEmail });
  });

  const invalidRegistrations = [
    { title: 'short name', patch: { name: 'A' }, field: 'name' },
    { title: 'invalid email', patch: { email: 'not-an-email' }, field: 'email' },
    { title: 'password shorter than 8', patch: { password: 'Ab1' }, field: 'password' },
    { title: 'password without a number', patch: { password: 'onlyletters' }, field: 'password' },
    { title: 'password without a letter', patch: { password: '12345678' }, field: 'password' },
  ];
  for (const { title, patch, field } of invalidRegistrations) {
    test(`rejects registration with ${title}`, async ({ api }) => {
      const res = await api.register(newUser(patch));
      expect(res.status()).toBe(400);
      const { error } = await res.json();
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.details.map((d) => d.field)).toContain(field);
    });
  }

  test('logs in the seeded customer', async ({ api }) => {
    const res = await api.login(USERS.customer.email, USERS.customer.password);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe(USERS.customer.email);
    expect(body.token.split('.')).toHaveLength(3); // JWT format
  });

  test('rejects a wrong password with 401 and a generic message', async ({ api }) => {
    const res = await api.login(USERS.customer.email, 'WrongPass123');
    expect(res.status()).toBe(401);
    expect((await res.json()).error.message).toBe(MESSAGES.invalidLogin);
  });

  test('does not reveal whether an email exists', async ({ api }) => {
    const res = await api.login('nobody.here@example.com', 'WrongPass123');
    expect(res.status()).toBe(401);
    expect((await res.json()).error.message).toBe(MESSAGES.invalidLogin);
  });

  test('GET /auth/me returns the current user', async ({ customer }) => {
    const res = await customer.api.me();
    expect(res.status()).toBe(200);
    expect((await res.json()).user).toMatchObject({ id: customer.id, email: customer.email });
  });

  test('GET /auth/me rejects missing and invalid tokens', async ({ api }) => {
    expect((await api.me()).status()).toBe(401);
    const invalid = await api.withToken('not.a.valid-token').me();
    expect(invalid.status()).toBe(401);
    expect((await invalid.json()).error.message).toBe('Invalid or expired token');
  });
});
