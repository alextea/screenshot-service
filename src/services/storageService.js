import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class StorageService {
  constructor() {
    this.s3Client = new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
      }
    });
  }

  async uploadToS3(buffer, storageConfig) {
    const startTime = Date.now();

    try {
      const params = {
        Bucket: storageConfig.bucket,
        Key: storageConfig.key,
        Body: buffer,
        ContentType: this.getContentType(storageConfig.key)
      };

      logger.debug({
        event: 'uploading_to_s3',
        bucket: storageConfig.bucket,
        key: storageConfig.key,
        size: buffer.length
      });

      const command = new PutObjectCommand(params);
      await this.s3Client.send(command);

      const duration = Date.now() - startTime;
      const s3Url = `https://${storageConfig.bucket}.s3.${storageConfig.region}.amazonaws.com/${storageConfig.key}`;

      logger.info({
        event: 's3_upload_complete',
        bucket: storageConfig.bucket,
        key: storageConfig.key,
        duration,
        url: s3Url
      });

      return {
        success: true,
        url: s3Url,
        bucket: storageConfig.bucket,
        key: storageConfig.key,
        size: buffer.length
      };

    } catch (error) {
      logger.error({
        event: 's3_upload_failed',
        bucket: storageConfig.bucket,
        key: storageConfig.key,
        error: error.message
      });

      throw new Error(`Failed to upload to S3: ${error.message}`);
    }
  }

  getContentType(key) {
    const extension = key.split('.').pop().toLowerCase();
    const contentTypes = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'webp': 'image/webp'
    };
    return contentTypes[extension] || 'application/octet-stream';
  }
}

// Singleton instance
const storageService = new StorageService();

export default storageService;
