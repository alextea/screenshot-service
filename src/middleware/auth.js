import config from '../config/index.js';
import logger from '../utils/logger.js';

// Simple in-memory rate limiter
const rateLimiter = new Map();

function cleanupRateLimiter() {
  const now = Date.now();
  for (const [key, data] of rateLimiter.entries()) {
    if (now - data.windowStart > config.rateLimit.windowMs) {
      rateLimiter.delete(key);
    }
  }
}

// Clean up rate limiter every minute
setInterval(cleanupRateLimiter, 60000);

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn({
      event: 'auth_failed',
      reason: 'missing_token',
      ip: req.ip
    });

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header'
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Check if token is valid
  if (!config.apiKeys.includes(token)) {
    logger.warn({
      event: 'auth_failed',
      reason: 'invalid_token',
      ip: req.ip
    });

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }

  // Rate limiting
  const now = Date.now();
  const rateLimitKey = `${token}:${req.ip}`;

  let rateLimitData = rateLimiter.get(rateLimitKey);

  if (!rateLimitData || now - rateLimitData.windowStart > config.rateLimit.windowMs) {
    // Start new window
    rateLimitData = {
      windowStart: now,
      requests: 0
    };
  }

  rateLimitData.requests++;
  rateLimiter.set(rateLimitKey, rateLimitData);

  if (rateLimitData.requests > config.rateLimit.maxRequests) {
    logger.warn({
      event: 'rate_limit_exceeded',
      apiKey: token.substring(0, 8) + '...',
      ip: req.ip,
      requests: rateLimitData.requests
    });

    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Max ${config.rateLimit.maxRequests} requests per minute.`,
      retryAfter: Math.ceil((config.rateLimit.windowMs - (now - rateLimitData.windowStart)) / 1000)
    });
  }

  // Attach API key to request for logging
  req.apiKey = token.substring(0, 8) + '...';

  next();
}

export default authenticate;
