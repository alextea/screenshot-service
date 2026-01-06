import browserPool from './browserPool.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

export async function captureScreenshot(url, options, retries = config.maxRetries) {
  const startTime = Date.now();
  let page = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      page = await browserPool.getPage();

      // Set viewport
      await page.setViewport({
        width: options.viewport?.width || 1200,
        height: options.viewport?.height || 630
      });

      logger.debug({
        event: 'navigating_to_url',
        url,
        attempt: attempt + 1
      });

      // Navigate to the page
      await page.goto(url, {
        waitUntil: options.waitUntil || 'networkidle0',
        timeout: options.timeout || config.browserTimeout
      });

      // Take screenshot
      const screenshot = await page.screenshot({
        type: options.format || 'png',
        quality: options.format === 'jpeg' ? (options.quality || 90) : undefined,
        fullPage: false
      });

      await browserPool.releasePage(page);
      page = null;

      const duration = Date.now() - startTime;

      logger.info({
        event: 'screenshot_captured',
        url,
        duration,
        size: screenshot.length,
        attempt: attempt + 1
      });

      return screenshot;

    } catch (error) {
      logger.error({
        event: 'screenshot_error',
        url,
        attempt: attempt + 1,
        error: error.message
      });

      // Release page if it was created
      if (page) {
        await browserPool.releasePage(page);
        page = null;
      }

      // If this was the last attempt, throw the error
      if (attempt === retries) {
        throw new Error(`Failed to capture screenshot after ${retries + 1} attempts: ${error.message}`);
      }

      // Exponential backoff before retry
      const backoffMs = 1000 * Math.pow(2, attempt);
      logger.info({
        event: 'retrying_screenshot',
        url,
        backoffMs,
        nextAttempt: attempt + 2
      });

      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
}
