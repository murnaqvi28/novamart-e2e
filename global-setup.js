require('dotenv').config();
const { request } = require('@playwright/test');

/**
 * Runs once before the whole suite:
 *  1. Waits for the app to be healthy (free hosting can take ~60s to wake up).
 *  2. Resets the database to seed data when TEST_RESET_KEY is provided.
 */
module.exports = async (config) => {
  const baseURL = config.projects[0].use.baseURL;
  const ctx = await request.newContext({ baseURL });
  const deadline = Date.now() + 120_000;
  let healthy = false;
  while (Date.now() < deadline) {
    try {
      const res = await ctx.get('/api/health', { timeout: 15_000 });
      if (res.ok()) { healthy = true; break; }
    } catch { /* still waking up */ }
    await new Promise((r) => setTimeout(r, 3_000));
  }
  if (!healthy) throw new Error(`App at ${baseURL} did not become healthy within 120s`);

  if (process.env.TEST_RESET_KEY) {
    const res = await ctx.post('/api/test/reset', { headers: { 'x-test-reset-key': process.env.TEST_RESET_KEY } });
    if (!res.ok()) throw new Error(`Database reset failed: HTTP ${res.status()} — check TEST_RESET_KEY`);
    console.log('✔ Database reset to seed data');
  }
  await ctx.dispose();
};
