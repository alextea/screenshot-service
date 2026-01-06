import express from 'express';
import queueService from '../services/queueService.js';
import { validateScreenshotRequest } from '../utils/validators.js';
import authenticate from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.post('/screenshot', authenticate, async (req, res, next) => {
  try {
    // Validate request
    const validation = validateScreenshotRequest(req.body);

    if (!validation.valid) {
      logger.warn({
        event: 'validation_failed',
        errors: validation.errors,
        apiKey: req.apiKey
      });

      return res.status(400).json({
        error: 'Validation Error',
        errors: validation.errors
      });
    }

    // Add job to queue
    const result = await queueService.addJob(req.body);

    logger.info({
      event: 'screenshot_requested',
      jobId: result.jobId,
      url: req.body.url,
      apiKey: req.apiKey
    });

    res.status(202).json(result);

  } catch (error) {
    next(error);
  }
});

router.get('/status/:jobId', authenticate, (req, res) => {
  const { jobId } = req.params;
  const job = queueService.getJob(jobId);

  if (!job) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Job ${jobId} not found`
    });
  }

  res.json({
    jobId: job.id,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    url: job.url,
    result: job.result,
    error: job.error
  });
});

export default router;
