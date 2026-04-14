// Shared test setup for the whole repo.

const { resetLoginRateLimits } = require('./src/middleware/loginRateLimit.js');

beforeEach(() => {
  resetLoginRateLimits();
});

// Mock outbound HTTP calls (pizza factory + metrics export).
global.fetch = jest.fn(async (url) => {
  // Pizza factory order endpoint: return jwt/reportUrl shape expected by orderRouter
  if (String(url).includes('/api/order')) {
    return {
      ok: true,
      async json() {
        return { jwt: 'test.jwt.token', reportUrl: 'http://example.com/report' };
      },
    };
  }

  // Metrics exporter: accept all writes
  return { ok: true, async json() { return {}; } };
});

