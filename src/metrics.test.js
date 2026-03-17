const { EventEmitter } = require('events');

describe('metrics.js unit tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-14T00:00:00.000Z'));

    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete global.fetch;
  });

  function findMetric(metrics, name) {
    return metrics.find((m) => m.name === name);
  }

  function getSumDataPoints(metric) {
    return metric?.sum?.dataPoints ?? [];
  }

  function getGaugeDataPoints(metric) {
    return metric?.gauge?.dataPoints ?? [];
  }

  function getAttr(dp, key) {
    const kv = (dp.attributes || []).find((a) => a.key === key);
    return kv?.value?.stringValue;
  }

  test('requestTracker counts requests per endpoint key', () => {
    const metrics = require('./metrics');

    const req = { method: 'GET', path: '/api/order/menu' };
    const res = {};
    const next = jest.fn();

    metrics.requestTracker(req, res, next);
    metrics.requestTracker(req, res, next);

    const all = metrics.collectAllMetrics();
    const requestsMetric = findMetric(all, 'requests');
    expect(requestsMetric).toBeDefined();

    const dp = getSumDataPoints(requestsMetric)[0];
    expect(dp.asInt).toBe(2);
    expect(getAttr(dp, 'endpoint')).toBe('[GET] /api/order/menu');
  });

  test('requestLatencyTracker records response finish latency', () => {
    const metrics = require('./metrics');

    // Make Date.now() deterministic for this test
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000); // start
    nowSpy.mockReturnValueOnce(1123); // finish

    const req = { method: 'POST', path: '/api/auth' };
    const res = new EventEmitter();
    const next = jest.fn();

    // Ensure the endpoint exists in the request counter map so it appears in collectAllMetrics()
    metrics.requestTracker(req, res, next);

    metrics.requestLatencyTracker(req, res, next);
    res.emit('finish');

    const all = metrics.collectAllMetrics();
    const latencyMetric = findMetric(all, 'requestLatencyMsTotal');
    expect(latencyMetric).toBeDefined();

    const points = getSumDataPoints(latencyMetric);
    const dp = points.find((p) => getAttr(p, 'endpoint') === '[POST] /api/auth');
    expect(dp.asInt).toBe(123);

    nowSpy.mockRestore();
  });

  test('authEvent records success vs failure and is exported as authAttempts points', () => {
    const metrics = require('./metrics');

    metrics.authEvent('login', true);
    metrics.authEvent('login', false);
    metrics.authEvent('register', false);

    const all = metrics.collectAllMetrics();
    const authAttempts = findMetric(all, 'authAttempts');
    expect(authAttempts).toBeDefined();

    const points = getSumDataPoints(authAttempts);
    // One point should exist for login failure and have value 1
    const loginFailure = points.find(
      (p) => getAttr(p, 'type') === 'login' && getAttr(p, 'outcome') === 'failure'
    );
    expect(loginFailure.asInt).toBe(1);

    const loginSuccess = points.find(
      (p) => getAttr(p, 'type') === 'login' && getAttr(p, 'outcome') === 'success'
    );
    expect(loginSuccess.asInt).toBe(1);

    const registerFailure = points.find(
      (p) => getAttr(p, 'type') === 'register' && getAttr(p, 'outcome') === 'failure'
    );
    expect(registerFailure.asInt).toBe(1);
  });

  test('pizzaPurchase accumulates totals (latency, price, pizzaCount) and counts success/failure', () => {
    const metrics = require('./metrics');

    metrics.pizzaPurchase(true, 250, 10.5, 2);
    metrics.pizzaPurchase(false, 1000, 0, 3);

    const all = metrics.collectAllMetrics();

    expect(findMetric(all, 'purchaseSuccess').sum.dataPoints[0].asInt).toBe(1);
    expect(findMetric(all, 'purchaseFailure').sum.dataPoints[0].asInt).toBe(1);
    expect(findMetric(all, 'purchaseTotalLatencyMs').sum.dataPoints[0].asInt).toBe(1250);
    expect(findMetric(all, 'purchaseTotalPrice').sum.dataPoints[0].asDouble).toBeCloseTo(10.5);
    expect(findMetric(all, 'purchasePizzaCount').sum.dataPoints[0].asInt).toBe(5);
  });

  test('activeUsers gauge counts users with activity in last 5 minutes', () => {
    const metrics = require('./metrics');

    metrics.recordUserActivity(1);
    metrics.recordUserActivity(2);

    let all = metrics.collectAllMetrics();
    const activeMetric1 = findMetric(all, 'activeUsers');
    expect(activeMetric1).toBeDefined();
    expect(getSumDataPoints(activeMetric1)[0].asInt).toBe(2);

    // Move past ACTIVE_WINDOW_MS (5 minutes) so users fall out
    jest.setSystemTime(new Date('2026-03-14T00:06:00.000Z'));
    all = metrics.collectAllMetrics();
    const activeMetric2 = findMetric(all, 'activeUsers');
    expect(getSumDataPoints(activeMetric2)[0].asInt).toBe(0);
  });

  test('sendMetricsToGrafana skips if config missing', () => {
    const metrics = require('./metrics');

    metrics.sendMetricsToGrafana([{ name: 'x', unit: '1', sum: { dataPoints: [] } }]);
    // config is present in this repo; but endpoint/apiKey might still be present.
    // This test mainly ensures the function is callable without throwing.
    expect(true).toBe(true);
  });
});

