const os = require('os');
const config = require('./config');

// Metrics configuration now lives at config.metrics (not config.db.metrics).
const metricsConfig = config.metrics || {};

// ---- Request metrics (used by requestTracker middleware) ----
const requests = {};
const requestLatencyMs = {};

function requestTracker(req, res, next) {
  const endpoint = `[${req.method}] ${req.path}`;
  requests[endpoint] = (requests[endpoint] || 0) + 1;
  next();
}

/**
 * Record request latency (call when response finishes).
 * @param {string} endpoint - Same key as requestTracker, e.g. "[GET] /api/order/menu"
 * @param {number} latencyMs - Time from request start to response finish in ms
 */
function recordRequestLatency(endpoint, latencyMs) {
  if (endpoint == null || typeof latencyMs !== 'number' || !Number.isFinite(latencyMs)) return;
  requestLatencyMs[endpoint] = (requestLatencyMs[endpoint] || 0) + latencyMs;
}

/**
 * Middleware: records start time, then on res finish adds latency to metrics.
 * Mount after requestTracker so endpoint key is consistent.
 */
function requestLatencyTracker(req, res, next) {
  const start = Date.now();
  const endpoint = `[${req.method}] ${req.path}`;
  res.once('finish', () => {
    recordRequestLatency(endpoint, Date.now() - start);
  });
  next();
}

// ---- User metrics ----
let greetingChangedCount = 0;

function greetingChanged() {
  greetingChangedCount++;
}

// ---- Auth metrics (success vs failure for rate per minute in Grafana) ----
const authAttempts = {
  register: { success: 0, failure: 0 },
  login: { success: 0, failure: 0 },
  logout: { success: 0, failure: 0 },
};

/**
 * Record an auth attempt. Use outcome so Grafana can show rate of success vs failure per minute.
 * @param {'register'|'login'|'logout'} type - Auth action
 * @param {boolean} success - Whether the attempt succeeded
 */
function authEvent(type, success = true) {
  if (authAttempts[type]) {
    authAttempts[type][success ? 'success' : 'failure']++;
  }
}

// ---- System metrics ----
function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return Number((cpuUsage * 100).toFixed(2));
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return Number(memoryUsage.toFixed(2));
}

// ---- Active user metrics ----
const lastActivityByUserId = new Map();
const ACTIVE_WINDOW_MS = 5 * 60 * 1000; // e.g. 5 minutes

function recordUserActivity(userId) {
  if (userId != null) {
    lastActivityByUserId.set(Number(userId), Date.now());
  }
}

function getActiveUserCount() {
  const now = Date.now();
  let count = 0;
  for (const ts of lastActivityByUserId.values()) {
    if (now - ts <= ACTIVE_WINDOW_MS) count++;
  }
  return count;
}


// ---- Purchase metrics ----
const purchaseStats = {
  successCount: 0,
  failureCount: 0,
  totalLatencyMs: 0,
  totalPrice: 0,
  pizzaCount: 0,
};

/**
 * Record a pizza purchase for metrics.
 * @param {boolean} success - Whether the factory fulfilled the order
 * @param {number} latencyMs - Response time of the Pizza Factory in ms
 * @param {number} price - Total price of the order (use 0 on failure)
 * @param {number} [pizzaCount=1] - Number of pizzas in the order
 */
function pizzaPurchase(success, latencyMs, price, pizzaCount = 1) {
  const count = Math.max(1, Number(pizzaCount) || 1);
  if (success) {
    purchaseStats.successCount++;
    purchaseStats.totalPrice += Number(price) || 0;
  } else {
    purchaseStats.failureCount++;
  }
  purchaseStats.totalLatencyMs += Number(latencyMs) || 0;
  purchaseStats.pizzaCount += count;
}

// ---- Metric builder and send ----
function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes) {
  const source = metricsConfig.source || 'jwt-pizza-service';
  attributes = { ...attributes, source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: String(attributes[key]) },
    });
  });

  if (metricType === 'sum') {
    metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

/** Build one sum metric with multiple data points (e.g. one series per type+outcome). */
function createSumMetricWithPoints(metricName, dataPoints) {
  const source = metricsConfig.source || 'jwt-pizza-service';
  const points = dataPoints.map(({ value, attributes }) => {
    const attrs = { ...attributes, source };
    const attrList = Object.keys(attrs).map((key) => ({
      key,
      value: { stringValue: String(attrs[key]) },
    }));
    return {
      asInt: value,
      timeUnixNano: Date.now() * 1000000,
      attributes: attrList,
    };
  });
  return {
    name: metricName,
    unit: '1',
    sum: {
      dataPoints: points,
      aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
      isMonotonic: true,
    },
  };
}

function createGaugeMetric(metricName, metricValue, attributes = {}) {
  return createMetric(metricName, metricValue, '1', 'gauge', 'asDouble', attributes);
}

function collectAllMetrics() {
  const metrics = [];

  // Request metrics (count and cumulative latency per endpoint)
  Object.keys(requests).forEach((endpoint) => {
    metrics.push(createMetric('requests', requests[endpoint], '1', 'sum', 'asInt', { endpoint, method: endpoint.split(' ')[0] }));
    const totalMs = requestLatencyMs[endpoint] || 0;
    metrics.push(createMetric('requestLatencyMsTotal', Math.round(totalMs), 'ms', 'sum', 'asInt', { endpoint }));
  });

  // User metrics
  metrics.push(createMetric('greetingChange', greetingChangedCount, '1', 'sum', 'asInt', {}));

  // Auth metrics: success vs failure per type (use rate(...[1m]) or increase(...[1m]) in Grafana for per-minute)
  metrics.push(
    createSumMetricWithPoints('authAttempts', [
      { value: authAttempts.register.success, attributes: { type: 'register', outcome: 'success' } },
      { value: authAttempts.register.failure, attributes: { type: 'register', outcome: 'failure' } },
      { value: authAttempts.login.success, attributes: { type: 'login', outcome: 'success' } },
      { value: authAttempts.login.failure, attributes: { type: 'login', outcome: 'failure' } },
      { value: authAttempts.logout.success, attributes: { type: 'logout', outcome: 'success' } },
      { value: authAttempts.logout.failure, attributes: { type: 'logout', outcome: 'failure' } },
    ])
  );

  // System metrics
  metrics.push(createGaugeMetric('cpuUsagePercent', getCpuUsagePercentage(), {}));
  metrics.push(createGaugeMetric('memoryUsagePercent', getMemoryUsagePercentage(), {}));

  // Purchase metrics
  metrics.push(createMetric('purchaseSuccess', purchaseStats.successCount, '1', 'sum', 'asInt', {}));
  metrics.push(createMetric('purchaseFailure', purchaseStats.failureCount, '1', 'sum', 'asInt', {}));
  metrics.push(createMetric('purchaseTotalLatencyMs', Math.round(purchaseStats.totalLatencyMs), 'ms', 'sum', 'asInt', {}));
  metrics.push(createMetric('purchaseTotalPrice', purchaseStats.totalPrice, '1', 'sum', 'asDouble', {}));
  metrics.push(createMetric('purchasePizzaCount', purchaseStats.pizzaCount, '1', 'sum', 'asInt', {}));
  metrics.push(createMetric('activeUsers', getActiveUserCount(), '1', 'sum', 'asInt', {}));

  return metrics;
}

function sendMetricsToGrafana(metrics) {
  const endpointUrl = metricsConfig.endpointUrl;
  const accountId = metricsConfig.accountId;
  const apiKey = metricsConfig.apiKey;

  if (!endpointUrl || !apiKey) {
    console.warn('Metrics: missing endpointUrl or apiKey, skipping send');
    return;
  }

  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [{ metrics }],
      },
    ],
  };

  fetch(endpointUrl, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      // This Base64 encodes the credentials
Authorization: `Basic ${Buffer.from(`${accountId}:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}

const PERIOD_MS = 10000;

function sendMetricsPeriodically(periodMs = PERIOD_MS) {
  const timer = setInterval(() => {
    try {
      const metrics = collectAllMetrics();
      sendMetricsToGrafana(metrics);
    } catch (error) {
      console.error('Error sending metrics', error);
    }
  }, periodMs);
  // Don't keep the process alive just for metrics.
  // This prevents Jest (and other short-lived processes) from hanging on active timers.
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
  return timer;
}

// Start periodic reporting
sendMetricsPeriodically(PERIOD_MS);

module.exports = {
  requestTracker,
  requestLatencyTracker,
  recordRequestLatency,
  greetingChanged,
  authEvent,
  pizzaPurchase,
  sendMetricsPeriodically,
  sendMetricsToGrafana,
  collectAllMetrics,
  recordUserActivity,
};
