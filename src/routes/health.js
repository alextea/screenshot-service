import express from 'express';
import browserPool from '../services/browserPool.js';
import queueService from '../services/queueService.js';

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const browserStats = browserPool.getStats();
    const queueStats = queueService.getStats();

    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      memory: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
      },
      browser: {
        isHealthy: await browserPool.isHealthy(),
        ...browserStats
      },
      queue: queueStats
    };

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

export default router;
