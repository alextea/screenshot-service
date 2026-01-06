import 'dotenv/config';
import express from 'express';
import config from './config/index.js';
import logger from './utils/logger.js';
import browserPool from './services/browserPool.js';
import errorHandler from './middleware/errorHandler.js';
import healthRoute from './routes/health.js';
import screenshotRoute from './routes/screenshot.js';

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      event: 'request',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.ip
    });
  });

  next();
});

// Routes
app.use('/v1', healthRoute);
app.use('/v1', screenshotRoute);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'screenshot-service',
    version: '1.0.0',
    endpoints: {
      health: 'GET /v1/health',
      screenshot: 'POST /v1/screenshot',
      status: 'GET /v1/status/:jobId'
    }
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Initialize browser pool on startup
async function startup() {
  try {
    logger.info({
      event: 'server_starting',
      nodeEnv: config.nodeEnv,
      port: config.port
    });

    // Initialize browser pool
    await browserPool.initialize();

    // Start server
    const server = app.listen(config.port, () => {
      logger.info({
        event: 'server_started',
        port: config.port,
        nodeEnv: config.nodeEnv
      });
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info({
        event: 'shutdown_initiated',
        signal
      });

      server.close(async () => {
        logger.info('HTTP server closed');

        // Cleanup browser pool
        await browserPool.cleanup();

        logger.info('Cleanup complete, exiting');
        process.exit(0);
      });

      // Force exit after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error({
      event: 'startup_failed',
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error({
    event: 'uncaught_exception',
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({
    event: 'unhandled_rejection',
    reason,
    promise
  });
});

// Start the server
startup();
