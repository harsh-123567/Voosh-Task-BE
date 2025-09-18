import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { RAGService } from '@/services/rag';
import logger from '@/utils/logger';
import { ValidationError, NotFoundError } from '@/utils/errors';
import { ChatRequest } from '@/types';

export class ChatController {
  private ragService: RAGService;

  constructor() {
    this.ragService = new RAGService();
  }

  async initialize(): Promise<void> {
    await this.ragService.initialize();
  }

  async chat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Invalid request data', errors.array());
      }

      const { session_id, user_message }: ChatRequest = req.body;

      // Process the chat query
      const response = await this.ragService.processQuery(session_id, user_message);

      logger.info(`Chat response generated for session: ${session_id}`);
      res.status(200).json({
        success: true,
        data: response,
      });
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { session_id } = req.params;

      if (!session_id) {
        throw new ValidationError('Session ID is required');
      }

      const messages = await this.ragService.getChatHistory(session_id);

      res.status(200).json({
        success: true,
        data: {
          session_id,
          messages,
          message_count: messages.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async clearHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { session_id } = req.params;

      if (!session_id) {
        throw new ValidationError('Session ID is required');
      }

      const deleted = await this.ragService.clearChatHistory(session_id);

      if (!deleted) {
        throw new NotFoundError(`Chat session not found: ${session_id}`);
      }

      logger.info(`Chat history cleared for session: ${session_id}`);
      res.status(200).json({
        success: true,
        message: 'Chat history cleared successfully',
        data: {
          session_id,
          cleared: true,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async searchDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Invalid request data', errors.array());
      }

      const { query, limit = 10, threshold = 0.6 } = req.body;

      const results = await this.ragService.searchSimilarDocuments(
        query,
        Math.min(limit, 20), // Cap at 20 results
        Math.max(threshold, 0.3) // Minimum threshold of 0.3
      );

      res.status(200).json({
        success: true,
        data: {
          query,
          results,
          result_count: results.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await this.ragService.getSystemStats();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async cleanup(): Promise<void> {
    await this.ragService.cleanup();
  }
}
