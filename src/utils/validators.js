import config from '../config/index.js';

export function validateScreenshotRequest(body) {
  const errors = [];

  // Validate URL
  if (!body.url) {
    errors.push('url is required');
  } else {
    try {
      const url = new URL(body.url);

      // Check if domain is in allowed list (if configured)
      if (config.allowedDomains.length > 0) {
        const isAllowed = config.allowedDomains.some(domain =>
          url.hostname === domain || url.hostname.endsWith(`.${domain}`)
        );
        if (!isAllowed) {
          errors.push(`domain ${url.hostname} is not in allowed domains list`);
        }
      }
    } catch (err) {
      errors.push('url must be a valid URL');
    }
  }

  // Validate storage
  if (!body.storage) {
    errors.push('storage is required');
  } else {
    if (!body.storage.bucket) {
      errors.push('storage.bucket is required');
    }
    if (!body.storage.region) {
      errors.push('storage.region is required');
    }
    if (!body.storage.key) {
      errors.push('storage.key is required');
    } else {
      // Prevent path traversal
      if (body.storage.key.includes('..')) {
        errors.push('storage.key cannot contain ".."');
      }
    }
  }

  // Validate viewport (optional, with defaults)
  if (body.viewport) {
    if (body.viewport.width) {
      const width = parseInt(body.viewport.width, 10);
      if (isNaN(width) || width < 100 || width > 4000) {
        errors.push('viewport.width must be between 100 and 4000');
      }
    }
    if (body.viewport.height) {
      const height = parseInt(body.viewport.height, 10);
      if (isNaN(height) || height < 100 || height > 4000) {
        errors.push('viewport.height must be between 100 and 4000');
      }
    }
  }

  // Validate format (optional)
  if (body.format && !['png', 'jpeg', 'webp'].includes(body.format)) {
    errors.push('format must be png, jpeg, or webp');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
