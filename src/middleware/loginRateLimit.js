const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

/** @type {Map<string, number[]>} */
const attemptsByIp = new Map();

function clientIp(req) {
  if (req.ip) return req.ip;
  if (req.socket?.remoteAddress) return req.socket.remoteAddress;
  return 'unknown';
}

function resetLoginRateLimits() {
  attemptsByIp.clear();
}

/**
 * Limits PUT /api/auth (login) to MAX_ATTEMPTS per IP per rolling WINDOW_MS.
 */
function loginRateLimit(req, res, next) {
  const ip = clientIp(req);
  const now = Date.now();
  let timestamps = attemptsByIp.get(ip) || [];
  timestamps = timestamps.filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_ATTEMPTS) {
    return res.status(429).json({ message: 'Too many attempts, try again later' });
  }

  timestamps.push(now);
  attemptsByIp.set(ip, timestamps);
  next();
}

module.exports = { loginRateLimit, resetLoginRateLimits };
