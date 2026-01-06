import puppeteer from 'puppeteer';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class BrowserPool {
  constructor() {
    this.browser = null;
    this.pages = new Set();
    this.isInitialized = false;
    this.initPromise = null;
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    // Prevent multiple simultaneous initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        logger.info('Initializing browser pool...');

        this.browser = await puppeteer.launch({
          headless: 'shell',
          executablePath: config.puppeteer.executablePath,
          args: config.puppeteer.args
        });

        this.isInitialized = true;

        logger.info({
          event: 'browser_initialized',
          version: await this.browser.version()
        });

        // Handle browser disconnect
        this.browser.on('disconnected', () => {
          logger.error('Browser disconnected unexpectedly');
          this.isInitialized = false;
          this.browser = null;
          this.initPromise = null;
        });

      } catch (error) {
        logger.error({ error: error.message }, 'Failed to initialize browser');
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  async getPage() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.pages.size >= config.maxConcurrent) {
      throw new Error(`Max concurrent pages reached (${config.maxConcurrent})`);
    }

    try {
      const page = await this.browser.newPage();
      this.pages.add(page);

      logger.debug({
        event: 'page_created',
        activePages: this.pages.size
      });

      return page;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create page');
      throw error;
    }
  }

  async releasePage(page) {
    try {
      if (page && !page.isClosed()) {
        await page.close();
      }
      this.pages.delete(page);

      logger.debug({
        event: 'page_released',
        activePages: this.pages.size
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error releasing page');
      this.pages.delete(page);
    }
  }

  async isHealthy() {
    if (!this.browser || !this.isInitialized) {
      return false;
    }

    try {
      // Try to get browser version as a health check
      await this.browser.version();
      return true;
    } catch (error) {
      logger.error({ error: error.message }, 'Browser health check failed');
      return false;
    }
  }

  getStats() {
    return {
      isInitialized: this.isInitialized,
      activePages: this.pages.size,
      maxConcurrent: config.maxConcurrent
    };
  }

  async cleanup() {
    logger.info('Cleaning up browser pool...');

    // Close all pages
    const pageClosures = Array.from(this.pages).map(page =>
      this.releasePage(page).catch(err =>
        logger.error({ error: err.message }, 'Error closing page during cleanup')
      )
    );

    await Promise.all(pageClosures);

    // Close browser
    if (this.browser) {
      try {
        await this.browser.close();
        logger.info('Browser closed successfully');
      } catch (error) {
        logger.error({ error: error.message }, 'Error closing browser');
      }
    }

    this.isInitialized = false;
    this.browser = null;
    this.initPromise = null;
  }
}

// Singleton instance
const browserPool = new BrowserPool();

export default browserPool;
