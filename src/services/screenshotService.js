import browserPool from './browserPool.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

export async function captureScreenshot(url, options, retries = config.maxRetries) {
  const startTime = Date.now();
  let page = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      page = await browserPool.getPage();

      // Set a realistic user agent to avoid bot detection
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      );

      // Set additional headers to appear more like a real browser
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      });

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
        waitUntil: options.waitUntil || 'networkidle2',
        timeout: options.timeout || config.browserTimeout
      });

      // Wait for Typekit CSS and fonts to load
      try {
        logger.info({
          event: 'waiting_for_typekit',
          url
        });

        // Wait for Typekit stylesheet to be present and loaded
        await page.waitForFunction(
          () => {
            const sheets = Array.from(document.styleSheets);
            const typekitSheet = sheets.find(s => s.href && s.href.includes('use.typekit.net'));
            if (!typekitSheet) return false;

            // Check if stylesheet is accessible (loaded)
            try {
              return typekitSheet.cssRules.length > 0;
            } catch (e) {
              return false;
            }
          },
          { timeout: 10000 }
        );

        logger.info({
          event: 'typekit_css_loaded',
          url
        });

        // Wait for fonts to be ready
        await page.evaluate(async () => {
          await document.fonts.ready;
        });

        // Additional delay for font rendering
        await new Promise(resolve => setTimeout(resolve, 3000));

        const fontInfo = await page.evaluate(() => {
          const fonts = Array.from(document.fonts);
          return {
            count: fonts.length,
            families: [...new Set(fonts.map(f => f.family))],
            statuses: fonts.map(f => ({ family: f.family, status: f.status }))
          };
        });

        logger.info({
          event: 'fonts_loaded',
          url,
          ...fontInfo
        });
      } catch (fontError) {
        // If font loading check fails, just wait and continue
        logger.warn({
          event: 'font_loading_check_failed',
          url,
          error: fontError.message
        });
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

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
        error: error.message,
        errorStack: error.stack,
        errorName: error.name
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
