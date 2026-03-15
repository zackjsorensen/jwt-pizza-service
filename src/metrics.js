const os = require('os');
const config = require('./config');

const metricsConfig = config.db?.metrics || {};

// ---- Request metrics (used by requestTracker middleware) ----
const requests = {};

function requestTracker(req, res, next) {
  const endpoint = `[${req.method}] ${req.path}`;
  requests[endpoint] = (requests[endpoint] || 0) + 1;
  next();
}

// ---- User metrics ----
let greetingChangedCount = 0;

function greetingChanged() {
  greetingChangedCount++;
}

// ---- Auth metrics ----
const authCounts = { register: 0, login: 0, logout: 0 };

function authEvent(event) {
  if (authCounts[event] !== undefined) {
    authCounts[event]++;
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

function createGaugeMetric(metricName, metricValue, attributes = {}) {
  return createMetric(metricName, metricValue, '1', 'gauge', 'asDouble', attributes);
}

function collectAllMetrics() {
  const metrics = [];

  // Request metrics
  Object.keys(requests).forEach((endpoint) => {
    metrics.push(createMetric('requests', requests[endpoint], '1', 'sum', 'asInt', { endpoint }));
  });

  // User metrics
  metrics.push(createMetric('greetingChange', greetingChangedCount, '1', 'sum', 'asInt', {}));

  // Auth metrics
  metrics.push(createMetric('authRegister', authCounts.register, '1', 'sum', 'asInt', {}));
  metrics.push(createMetric('authLogin', authCounts.login, '1', 'sum', 'asInt', {}));
  metrics.push(createMetric('authLogout', authCounts.logout, '1', 'sum', 'asInt', {}));

  // System metrics
  metrics.push(createGaugeMetric('cpuUsagePercent', getCpuUsagePercentage(), {}));
  metrics.push(createGaugeMetric('memoryUsagePercent', getMemoryUsagePercentage(), {}));

  // Purchase metrics
  metrics.push(createMetric('purchaseSuccess', purchaseStats.successCount, '1', 'sum', 'asInt', {}));
  metrics.push(createMetric('purchaseFailure', purchaseStats.failureCount, '1', 'sum', 'asInt', {}));
  metrics.push(createMetric('purchaseTotalLatencyMs', Math.round(purchaseStats.totalLatencyMs), 'ms', 'sum', 'asInt', {}));
  metrics.push(createMetric('purchaseTotalPrice', purchaseStats.totalPrice, '1', 'sum', 'asDouble', {}));
  metrics.push(createMetric('purchasePizzaCount', purchaseStats.pizzaCount, '1', 'sum', 'asInt', {}));

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
      Authorization: `Bearer ${accountId}:${apiKey}`,
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
  return timer;
}

// Start periodic reporting
sendMetricsPeriodically(PERIOD_MS);

module.exports = {
  requestTracker,
  greetingChanged,
  authEvent,
  pizzaPurchase,
  sendMetricsPeriodically,
  sendMetricsToGrafana,
  collectAllMetrics,
};
