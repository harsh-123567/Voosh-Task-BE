import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import config from '@/config';
import logger from '@/utils/logger';
import { AppError } from '@/utils/errors';

// CORS middleware
export const corsMiddleware = cors({
  origin: config.corsOrigin,
  credentials: true,
  optionsSuccessStatus: 200,
});

// Security middleware
export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
});

// Rate limiting middleware
export const rateLimitMiddleware = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Logging middleware
export const loggingMiddleware = morgan('combined', {
  stream: {
    write: (message: string) => {
      logger.info(message.trim());
    },
  },
});

// Error handling middleware
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
        ...(config.nodeEnv === 'development' && { details: err.details }),
      },
    });
    return;
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        ...(config.nodeEnv === 'development' && { details: err.message }),
      },
    });
    return;
  }

  // Handle unexpected errors
  res.status(500).json({
    success: false,
    error: {
      message: config.nodeEnv === 'production' ? 'Internal server error' : err.message,
      code: 'INTERNAL_SERVER_ERROR',
      ...(config.nodeEnv === 'development' && { stack: err.stack }),
    },
  });
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'NOT_FOUND',
    },
  });
};

// Health check middleware
export const healthCheck = (req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
};
