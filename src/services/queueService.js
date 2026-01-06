import PQueue from 'p-queue';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { captureScreenshot } from './screenshotService.js';
import storageService from './storageService.js';

class QueueService {
  constructor() {
    this.queue = new PQueue({ concurrency: config.maxConcurrent });
    this.jobs = new Map(); // jobId -> job status
  }

  async addJob(requestData) {
    const jobId = uuidv4();

    const job = {
      id: jobId,
      status: 'queued',
      createdAt: new Date().toISOString(),
      url: requestData.url,
      metadata: requestData.metadata || {}
    };

    this.jobs.set(jobId, job);

    logger.info({
      event: 'job_queued',
      jobId,
      url: requestData.url,
      queueSize: this.queue.size,
      pending: this.queue.pending
    });

    // Add job to queue (fire-and-forget)
    this.queue.add(() => this.processJob(jobId, requestData))
      .catch(error => {
        logger.error({
          event: 'job_failed',
          jobId,
          error: error.message
        });

        // Update job status
        const failedJob = this.jobs.get(jobId);
        if (failedJob) {
          failedJob.status = 'failed';
          failedJob.error = error.message;
          failedJob.completedAt = new Date().toISOString();
        }
      });

    return {
      jobId,
      status: 'queued',
      statusUrl: `/v1/status/${jobId}`
    };
  }

  async processJob(jobId, requestData) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    try {
      // Update status to processing
      job.status = 'processing';
      job.startedAt = new Date().toISOString();

      logger.info({
        event: 'job_processing',
        jobId,
        url: requestData.url
      });

      // Capture screenshot
      const screenshotBuffer = await captureScreenshot(
        requestData.url,
        {
          viewport: requestData.viewport,
          format: requestData.format,
          quality: requestData.options?.quality,
          waitUntil: requestData.options?.waitUntil,
          timeout: requestData.options?.timeout
        }
      );

      // Upload to S3
      const uploadResult = await storageService.uploadToS3(
        screenshotBuffer,
        requestData.storage
      );

      // Update job status to completed
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.result = uploadResult;

      logger.info({
        event: 'job_completed',
        jobId,
        url: requestData.url,
        s3Url: uploadResult.url,
        duration: new Date(job.completedAt) - new Date(job.startedAt)
      });

      return uploadResult;

    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date().toISOString();

      logger.error({
        event: 'job_failed',
        jobId,
        url: requestData.url,
        error: error.message
      });

      throw error;
    }
  }

  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  getStats() {
    return {
      queueSize: this.queue.size,
      pending: this.queue.pending,
      totalJobs: this.jobs.size
    };
  }

  // Clean up old jobs (older than 1 hour)
  cleanup() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const [jobId, job] of this.jobs.entries()) {
      const jobDate = new Date(job.createdAt);
      if (jobDate < oneHourAgo && (job.status === 'completed' || job.status === 'failed')) {
        this.jobs.delete(jobId);
      }
    }

    logger.debug({
      event: 'jobs_cleaned_up',
      remainingJobs: this.jobs.size
    });
  }
}

// Singleton instance
const queueService = new QueueService();

// Schedule cleanup every 15 minutes
setInterval(() => {
  queueService.cleanup();
}, 15 * 60 * 1000);

export default queueService;
