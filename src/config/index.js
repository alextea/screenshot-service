export default {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8080', 10),

  // AWS S3
  aws: {
    region: process.env.AWS_REGION || 'eu-west-2',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },

  // Authentication
  apiKeys: process.env.API_KEYS ? process.env.API_KEYS.split(',') : [],
  allowedDomains: process.env.ALLOWED_DOMAINS ? process.env.ALLOWED_DOMAINS.split(',') : [],

  // Screenshot settings
  maxConcurrent: parseInt(process.env.MAX_CONCURRENT || '3', 10),
  browserTimeout: parseInt(process.env.BROWSER_TIMEOUT || '30000', 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || '2', 10),

  // Rate limiting
  rateLimit: {
    windowMs: 60000, // 1 minute
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '10', 10)
  },

  // Puppeteer
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--no-first-run',
      '--no-zygote',
      '--deterministic-fetch',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--disable-features=BlockInsecurePrivateNetworkRequests'
    ]
  }
};
