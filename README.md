# Screenshot Service

A standalone Puppeteer-based microservice for generating social media sharing images (screenshots) from web pages. Designed to serve multiple web applications with different content models.

## Features

- **Puppeteer-based screenshot generation** with headless Chromium
- **S3 storage integration** for image hosting
- **Fire-and-forget async processing** with job queue
- **API key authentication** and rate limiting
- **Automatic retries** with exponential backoff
- **Memory-optimized** for serverless/container platforms
- **Health monitoring** and metrics endpoints
- **Docker-ready** with Fly.io deployment configuration

## Architecture

- **Runtime**: Node.js 22.x
- **Framework**: Express
- **Screenshot Engine**: Puppeteer
- **Storage**: AWS S3
- **Queue**: p-queue (in-memory, 3 concurrent max)
- **Logging**: Pino (structured JSON logging)

## API Endpoints

### POST /v1/screenshot

Request a screenshot to be captured and uploaded to S3.

**Authentication**: Bearer token (API key)

**Request Body**:
```json
{
  "url": "https://example.com/page-to-screenshot",
  "storage": {
    "provider": "s3",
    "bucket": "screenshots-shared",
    "region": "eu-west-2",
    "key": "app-name/screenshot-name.png"
  },
  "viewport": {
    "width": 1200,
    "height": 630
  },
  "format": "png",
  "options": {
    "waitUntil": "networkidle0",
    "timeout": 30000,
    "quality": 90
  },
  "metadata": {
    "app": "my-app",
    "resourceId": "some-id",
    "resourceType": "page"
  }
}
```

**Response** (202 Accepted):
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "statusUrl": "/v1/status/550e8400-e29b-41d4-a716-446655440000"
}
```

### GET /v1/status/:jobId

Check the status of a screenshot job.

**Authentication**: Bearer token (API key)

**Response**:
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "createdAt": "2024-01-06T10:00:00.000Z",
  "startedAt": "2024-01-06T10:00:01.000Z",
  "completedAt": "2024-01-06T10:00:05.000Z",
  "url": "https://example.com/page",
  "result": {
    "success": true,
    "url": "https://screenshots-shared.s3.eu-west-2.amazonaws.com/app-name/screenshot.png",
    "bucket": "screenshots-shared",
    "key": "app-name/screenshot.png",
    "size": 145234
  }
}
```

### GET /v1/health

Health check endpoint with system metrics.

**No authentication required**

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-06T10:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "heapUsed": "120MB",
    "heapTotal": "180MB",
    "rss": "250MB"
  },
  "browser": {
    "isHealthy": true,
    "isInitialized": true,
    "activePages": 1,
    "maxConcurrent": 3
  },
  "queue": {
    "queueSize": 2,
    "pending": 1,
    "totalJobs": 15
  }
}
```

## Installation & Setup

### Prerequisites

- Node.js 22.x
- AWS account with S3 access
- Fly.io account (for deployment) or Docker

### Local Development

1. **Clone and install dependencies**:
```bash
cd screenshot-service
npm install
```

2. **Configure environment variables**:
```bash
cp .env.example .env
# Edit .env with your AWS credentials and API keys
```

3. **Start the service**:
```bash
npm run dev
```

The service will be available at `http://localhost:8080`

### Testing Locally

**Health check**:
```bash
curl http://localhost:8080/v1/health
```

**Request a screenshot**:
```bash
curl -X POST http://localhost:8080/v1/screenshot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "url": "https://example.com",
    "storage": {
      "bucket": "your-bucket",
      "region": "eu-west-2",
      "key": "test/example.png"
    },
    "viewport": {
      "width": 1200,
      "height": 630
    },
    "format": "png"
  }'
```

## Deployment to Fly.io

### First-Time Setup

1. **Install Fly CLI**:
```bash
brew install flyctl  # macOS
# or visit https://fly.io/docs/hands-on/install-flyctl/
```

2. **Login to Fly.io**:
```bash
flyctl auth login
```

3. **Create the app**:
```bash
flyctl apps create screenshot-service
```

4. **Set secrets** (environment variables):
```bash
flyctl secrets set \
  AWS_ACCESS_KEY_ID=your-key \
  AWS_SECRET_ACCESS_KEY=your-secret \
  AWS_REGION=eu-west-2 \
  API_KEYS=key1,key2,key3 \
  ALLOWED_DOMAINS=domain1.com,domain2.com
```

5. **Deploy**:
```bash
flyctl deploy
```

### Subsequent Deployments

```bash
flyctl deploy
```

### View Logs

```bash
flyctl logs
```

### Scale Resources

```bash
# Upgrade to 1GB RAM if needed
flyctl scale memory 1024

# Add more instances
flyctl scale count 2
```

## AWS S3 Setup

### Create S3 Bucket

```bash
aws s3 mb s3://screenshots-shared --region eu-west-2
```

### Configure Bucket Policy

Allow public reads for social media crawlers:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicRead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::screenshots-shared/*"
    }
  ]
}
```

### Configure CORS

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

### Create IAM User

1. Create IAM user: `screenshot-service`
2. Attach policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::screenshots-shared/*"
    }
  ]
}
```

3. Generate access keys and add to Fly.io secrets

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | `development` |
| `PORT` | Server port | `8080` |
| `AWS_ACCESS_KEY_ID` | AWS access key | Required |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Required |
| `AWS_REGION` | AWS region | `eu-west-2` |
| `API_KEYS` | Comma-separated API keys | Required |
| `ALLOWED_DOMAINS` | Comma-separated allowed domains | (optional) |
| `MAX_CONCURRENT` | Max concurrent screenshots | `3` |
| `BROWSER_TIMEOUT` | Browser timeout (ms) | `30000` |
| `MAX_RETRIES` | Screenshot retry attempts | `2` |
| `RATE_LIMIT_MAX` | Requests per minute per key | `10` |

### S3 Bucket Structure

Organize screenshots by app:

```
screenshots-shared/
├── music-genre-ator/
│   ├── ambient-techno.png
│   └── jazz-fusion.png
├── app-2/
│   └── posts/
│       └── post-123.png
└── app-3/
    └── products/
        └── product-456.png
```

## Client Integration

### Example: Node.js/Express App

```javascript
async function requestScreenshot(slug) {
  const response = await fetch('https://screenshot-service.fly.dev/v1/screenshot', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SCREENSHOT_SERVICE_API_KEY}`
    },
    body: JSON.stringify({
      url: `${process.env.SITE_URL}/screenshot/${slug}`,
      storage: {
        provider: 's3',
        bucket: 'screenshots-shared',
        region: 'eu-west-2',
        key: `my-app/${slug}.png`
      },
      viewport: {
        width: 1200,
        height: 630
      },
      format: 'png',
      metadata: {
        app: 'my-app',
        resourceId: slug
      }
    })
  });

  return response.json();
}
```

## Monitoring

### Key Metrics

- **Request rate**: Screenshots per minute
- **Success rate**: Completed vs failed jobs
- **Duration**: Time to capture and upload
- **Memory usage**: Monitor for leaks
- **Queue depth**: Jobs waiting to be processed

### Health Check

Monitor `/v1/health` endpoint:
- Browser health status
- Memory usage
- Active screenshots
- Queue status

### Logs

All events are logged in structured JSON format:

```json
{
  "event": "screenshot_completed",
  "jobId": "550e8400-...",
  "url": "https://example.com/page",
  "duration": 3200,
  "s3Url": "https://bucket.s3.region.amazonaws.com/key.png"
}
```

## Security

- **API Key Authentication**: Bearer token per app
- **Rate Limiting**: 10 requests/minute per key (configurable)
- **Domain Whitelist**: Optional domain filtering
- **Input Validation**: URL format, viewport limits, path traversal prevention
- **Non-root Container**: Docker runs as non-root user

## Troubleshooting

### Memory Issues

If you see OOM errors:
1. Increase Fly.io VM memory: `flyctl scale memory 1024`
2. Reduce `MAX_CONCURRENT` to 2 or 1
3. Check for memory leaks in logs

### Slow Screenshots

- Check browser timeout setting
- Verify target URL is accessible
- Monitor queue depth
- Consider adding more instances

### S3 Upload Failures

- Verify IAM credentials
- Check bucket policy and CORS
- Ensure bucket region matches configuration

## Cost Estimate

### Fly.io (Single Instance)
- **Development**: Free (256MB shared CPU)
- **Production**: $5-7/month (512MB shared CPU)
- **High Traffic**: $12-15/month (1GB RAM)

### AWS S3
- **Storage**: ~$0.01/month (500 screenshots)
- **Requests**: ~$0.01/month (1000 PUTs)
- **Total**: ~$6-9/month for 2-3 apps

## License

MIT
