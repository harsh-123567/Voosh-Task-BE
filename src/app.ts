import express from 'express';
import config from '@/config';
import logger from '@/utils/logger';
import routes from '@/routes';
import {
  corsMiddleware,
  securityMiddleware,
  rateLimitMiddleware,
  loggingMiddleware,
  errorHandler,
  notFoundHandler,
} from '@/utils/middleware';

const app = express();

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs';
try {
  mkdirSync('logs', { recursive: true });
} catch (error) {
  // Directory might already exist
}

// Middleware
app.use(securityMiddleware);
app.use(corsMiddleware);
app.use(rateLimitMiddleware);
app.use(loggingMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = (signal: string): void => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
  logger.info(`Health check available at http://localhost:${config.port}/api/health`);
});

// Handle server errors
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  switch (error.code) {
    case 'EACCES':
      logger.error(`Port ${config.port} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`Port ${config.port} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

export default app;
