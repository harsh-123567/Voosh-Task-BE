import Redis from 'ioredis';
import config from '@/config';
import logger from '@/utils/logger';
import { ChatSession, ChatMessage } from '@/types';
import { InternalServerError } from '@/utils/errors';

export class RedisRepository {
  private client: Redis;
  private readonly SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds

  constructor() {
    const redisOptions: any = {
      enableReadyCheck: false,
      lazyConnect: true,
    };

    if (config.redis.password) {
      redisOptions.password = config.redis.password;
    }

    this.client = new Redis(config.redis.url, redisOptions);
    logger.info(
      `Initializing Redis client with URL: ${config.redis.url.replace(/\/\/.*@/, '//***@')}`
    );

    this.client.on('error', error => {
      logger.error('Redis connection error:', error);
    });

    this.client.on('connect', () => {
      logger.info('Connected to Redis');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw new InternalServerError('Failed to connect to Redis', error);
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  private getSessionKey(sessionId: string): string {
    return `chat:session:${sessionId}`;
  }

  async saveSession(session: ChatSession): Promise<void> {
    try {
      const key = this.getSessionKey(session.id);
      const sessionData = JSON.stringify(session);

      await this.client.setex(key, this.SESSION_TTL, sessionData);
      logger.debug(`Saved session ${session.id} to Redis`);
    } catch (error) {
      logger.error(`Failed to save session ${session.id}:`, error);
      throw new InternalServerError('Failed to save chat session', error);
    }
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    try {
      const key = this.getSessionKey(sessionId);
      const sessionData = await this.client.get(key);

      if (!sessionData) {
        return null;
      }

      const session = JSON.parse(sessionData) as ChatSession;
      // Convert string dates back to Date objects
      session.createdAt = new Date(session.createdAt);
      session.updatedAt = new Date(session.updatedAt);
      session.messages = session.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));

      logger.debug(`Retrieved session ${sessionId} from Redis`);
      return session;
    } catch (error) {
      logger.error(`Failed to get session ${sessionId}:`, error);
      throw new InternalServerError('Failed to retrieve chat session', error);
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const key = this.getSessionKey(sessionId);
      const result = await this.client.del(key);

      logger.debug(`Deleted session ${sessionId} from Redis`);
      return result > 0;
    } catch (error) {
      logger.error(`Failed to delete session ${sessionId}:`, error);
      throw new InternalServerError('Failed to delete chat session', error);
    }
  }

  async addMessageToSession(sessionId: string, message: ChatMessage): Promise<void> {
    try {
      const session = await this.getSession(sessionId);

      if (!session) {
        // Create new session if it doesn't exist
        const newSession: ChatSession = {
          id: sessionId,
          messages: [message],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await this.saveSession(newSession);
      } else {
        // Add message to existing session
        session.messages.push(message);
        session.updatedAt = new Date();
        await this.saveSession(session);
      }

      logger.debug(`Added message to session ${sessionId}`);
    } catch (error) {
      logger.error(`Failed to add message to session ${sessionId}:`, error);
      throw new InternalServerError('Failed to add message to session', error);
    }
  }

  async extendSessionTTL(sessionId: string): Promise<void> {
    try {
      const key = this.getSessionKey(sessionId);
      await this.client.expire(key, this.SESSION_TTL);

      logger.debug(`Extended TTL for session ${sessionId}`);
    } catch (error) {
      logger.error(`Failed to extend TTL for session ${sessionId}:`, error);
      // Don't throw here as this is not critical
    }
  }

  async getSessionCount(): Promise<number> {
    try {
      const keys = await this.client.keys('chat:session:*');
      return keys.length;
    } catch (error) {
      logger.error('Failed to get session count:', error);
      return 0;
    }
  }
}
