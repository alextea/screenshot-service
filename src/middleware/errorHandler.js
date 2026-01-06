import logger from '../utils/logger.js';

export default function errorHandler(err, req, res, next) {
  logger.error({
    event: 'error',
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Default to 500 server error
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}
