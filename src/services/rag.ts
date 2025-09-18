import { v4 as uuidv4 } from 'uuid';
import { EmbeddingService } from './embedding';
import { LLMService } from './llm';
import { QdrantRepository } from '@/repositories/qdrant';
import { RedisRepository } from '@/repositories/redis';
import logger from '@/utils/logger';
import { DocumentChunk, ChatMessage, ChatResponse, RAGContext, VectorSearchResult } from '@/types';
import { InternalServerError } from '@/utils/errors';

export class RAGService {
  private embeddingService: EmbeddingService;
  private llmService: LLMService;
  private qdrantRepository: QdrantRepository;
  private redisRepository: RedisRepository;

  constructor() {
    this.embeddingService = new EmbeddingService();
    this.llmService = new LLMService();
    this.qdrantRepository = new QdrantRepository();
    this.redisRepository = new RedisRepository();
  }

  async initialize(): Promise<void> {
    try {
      await Promise.all([this.qdrantRepository.initialize(), this.redisRepository.connect()]);
      logger.info('RAG Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize RAG Service:', error);
      throw new InternalServerError('Failed to initialize RAG Service', error);
    }
  }

  async processQuery(
    sessionId: string,
    userMessage: string,
    retrievalLimit: number = 5,
    similarityThreshold: number = 0.7
  ): Promise<ChatResponse> {
    try {
      // Generate user message ID and create message object
      const userMessageId = uuidv4();
      const userChatMessage: ChatMessage = {
        id: userMessageId,
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      };

      // Add user message to session
      await this.redisRepository.addMessageToSession(sessionId, userChatMessage);

      // Get chat history for context
      const session = await this.redisRepository.getSession(sessionId);
      const chatHistory = session?.messages || [];

      // Generate embedding for user query
      const queryEmbedding = await this.embeddingService.generateSingleEmbedding(userMessage);

      // Retrieve similar documents from vector database
      const searchResults = await this.qdrantRepository.searchSimilar(
        queryEmbedding,
        retrievalLimit,
        similarityThreshold
      );

      // Extract document chunks from search results
      const retrievedChunks = searchResults.map(result => ({
        ...result.payload,
        score: result.score,
      }));

      // Generate response using LLM
      const responseText = await this.llmService.generateResponse(
        userMessage,
        retrievedChunks,
        chatHistory.slice(-10) // Use last 10 messages for context
      );

      // Create assistant message
      const assistantMessageId = uuidv4();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      };

      // Add assistant message to session
      await this.redisRepository.addMessageToSession(sessionId, assistantMessage);

      // Extend session TTL
      await this.redisRepository.extendSessionTTL(sessionId);

      // Log RAG context for debugging
      const ragContext: RAGContext = {
        query: userMessage,
        retrievedChunks,
        response: responseText,
      };
      logger.debug('RAG Context:', ragContext);

      return {
        message: responseText,
        session_id: sessionId,
        message_id: assistantMessageId,
        sources: retrievedChunks,
      };
    } catch (error) {
      logger.error(`Failed to process query for session ${sessionId}:`, error);
      throw new InternalServerError('Failed to process chat query', error);
    }
  }

  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    try {
      const session = await this.redisRepository.getSession(sessionId);
      return session?.messages || [];
    } catch (error) {
      logger.error(`Failed to get chat history for session ${sessionId}:`, error);
      throw new InternalServerError('Failed to retrieve chat history', error);
    }
  }

  async clearChatHistory(sessionId: string): Promise<boolean> {
    try {
      return await this.redisRepository.deleteSession(sessionId);
    } catch (error) {
      logger.error(`Failed to clear chat history for session ${sessionId}:`, error);
      throw new InternalServerError('Failed to clear chat history', error);
    }
  }

  async indexDocuments(documents: DocumentChunk[]): Promise<void> {
    try {
      if (documents.length === 0) {
        logger.warn('No documents to index');
        return;
      }

      // Generate embeddings for all documents
      const texts = documents.map(doc => doc.content);
      const embeddings = await this.embeddingService.batchEmbeddings(texts);

      // Store in vector database
      await this.qdrantRepository.upsertDocuments(documents, embeddings);

      logger.info(`Successfully indexed ${documents.length} documents`);
    } catch (error) {
      logger.error('Failed to index documents:', error);
      throw new InternalServerError('Failed to index documents', error);
    }
  }

  async searchSimilarDocuments(
    query: string,
    limit: number = 10,
    threshold: number = 0.6
  ): Promise<VectorSearchResult[]> {
    try {
      const queryEmbedding = await this.embeddingService.generateSingleEmbedding(query);
      return await this.qdrantRepository.searchSimilar(queryEmbedding, limit, threshold);
    } catch (error) {
      logger.error('Failed to search similar documents:', error);
      throw new InternalServerError('Failed to search documents', error);
    }
  }

  async getSystemStats(): Promise<{
    vectorDbCount: number;
    vectorDbStatus: string;
    activeSessions: number;
  }> {
    try {
      const [vectorInfo, sessionCount] = await Promise.all([
        this.qdrantRepository.getCollectionInfo(),
        this.redisRepository.getSessionCount(),
      ]);

      return {
        vectorDbCount: vectorInfo.count,
        vectorDbStatus: vectorInfo.status,
        activeSessions: sessionCount,
      };
    } catch (error) {
      logger.error('Failed to get system stats:', error);
      return {
        vectorDbCount: 0,
        vectorDbStatus: 'error',
        activeSessions: 0,
      };
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.redisRepository.disconnect();
      logger.info('RAG Service cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup RAG Service:', error);
    }
  }
}
