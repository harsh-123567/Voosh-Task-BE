import { APIError } from '@/types';

export class AppError extends Error implements APIError {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
  }
}

export class InternalServerError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: unknown) {
    super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}
