import config from './index';
import logger from '@/utils/logger';

export interface DatabaseConfig {
  qdrant: {
    url: string;
    apiKey?: string;
  };
  redis: {
    url: string;
  };
}

export function getDatabaseConfig(): DatabaseConfig {
  const isProduction = config.nodeEnv === 'production';
  const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';

  // Qdrant configuration
  let qdrantUrl = config.qdrant.url;
  let qdrantApiKey = config.qdrant.apiKey;

  // Redis configuration
  let redisUrl = config.redis.url;

  // Log configuration being used
  logger.info('Database configuration:', {
    environment: config.nodeEnv,
    isRailway,
    qdrantUrl: qdrantUrl.replace(/\/\/.*@/, '//***@'), // Hide credentials in logs
    redisUrl: redisUrl.replace(/\/\/.*@/, '//***@'), // Hide credentials in logs
    hasQdrantApiKey: !!qdrantApiKey,
  });

  return {
    qdrant: {
      url: qdrantUrl,
      ...(qdrantApiKey !== undefined ? { apiKey: qdrantApiKey } : {}),
    },
    redis: {
      url: redisUrl,
    },
  };
}

export function validateDatabaseConfig(): void {
  const dbConfig = getDatabaseConfig();

  // Validate Qdrant URL
  if (!dbConfig.qdrant.url) {
    throw new Error('QDRANT_URL environment variable is required');
  }

  try {
    new URL(dbConfig.qdrant.url);
  } catch (error) {
    throw new Error(`Invalid QDRANT_URL format: ${dbConfig.qdrant.url}`);
  }

  // Validate Redis URL
  if (!dbConfig.redis.url) {
    throw new Error('REDIS_URL environment variable is required');
  }

  try {
    new URL(dbConfig.redis.url);
  } catch (error) {
    throw new Error(`Invalid REDIS_URL format: ${dbConfig.redis.url}`);
  }

  // Warn if using local services in production
  if (process.env.NODE_ENV === 'production') {
    if (dbConfig.qdrant.url.includes('localhost') || dbConfig.qdrant.url.includes('127.0.0.1')) {
      logger.warn('⚠️  Using localhost Qdrant URL in production environment');
    }

    if (dbConfig.redis.url.includes('localhost') || dbConfig.redis.url.includes('127.0.0.1')) {
      logger.warn('⚠️  Using localhost Redis URL in production environment');
    }

    if (!dbConfig.qdrant.apiKey && dbConfig.qdrant.url.includes('qdrant.tech')) {
      logger.warn('⚠️  Qdrant Cloud URL detected but no API key provided');
    }
  }

  logger.info('✅ Database configuration validated successfully');
}
