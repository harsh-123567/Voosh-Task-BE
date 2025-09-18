import { QdrantClient } from '@qdrant/qdrant-js';
import config from '@/config';
import logger from '@/utils/logger';
import { DocumentChunk, VectorSearchResult } from '@/types';
import { InternalServerError } from '@/utils/errors';

export class QdrantRepository {
  private client: QdrantClient;
  private readonly collectionName = 'news_articles';
  private readonly vectorSize = 768; // Jina embeddings dimension

  constructor() {
    const clientConfig: any = {
      url: config.qdrant.url,
    };

    if (config.qdrant.apiKey) {
      clientConfig.apiKey = config.qdrant.apiKey;
    }

    this.client = new QdrantClient(clientConfig);
    logger.info(
      `Initializing Qdrant client with URL: ${config.qdrant.url.replace(/\/\/.*@/, '//***@')}`
    );
  }

  async initialize(): Promise<void> {
    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        col => col.name === this.collectionName
      );

      if (!collectionExists) {
        // Create collection
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine',
          },
        });
        logger.info(`Created Qdrant collection: ${this.collectionName}`);
      } else {
        logger.info(`Qdrant collection already exists: ${this.collectionName}`);
      }
    } catch (error) {
      logger.error('Failed to initialize Qdrant:', error);
      throw new InternalServerError('Failed to initialize vector database', error);
    }
  }

  async upsertDocuments(documents: DocumentChunk[], embeddings: number[][]): Promise<void> {
    try {
      if (documents.length !== embeddings.length) {
        throw new Error('Documents and embeddings arrays must have the same length');
      }

      const points = documents.map((doc, index) => ({
        id: doc.id,
        vector: embeddings[index] || [],
        payload: {
          content: doc.content,
          metadata: doc.metadata,
        },
      }));

      await this.client.upsert(this.collectionName, {
        wait: true,
        points,
      });

      logger.info(`Upserted ${documents.length} documents to Qdrant`);
    } catch (error) {
      logger.error('Failed to upsert documents to Qdrant:', error);
      throw new InternalServerError('Failed to store documents in vector database', error);
    }
  }

  async searchSimilar(
    queryEmbedding: number[],
    limit: number = 5,
    threshold: number = 0.7
  ): Promise<VectorSearchResult[]> {
    try {
      const searchResult = await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        limit,
        score_threshold: threshold,
        with_payload: true,
      });

      const results: VectorSearchResult[] = searchResult.map(point => ({
        id: String(point.id),
        score: point.score || 0,
        payload: {
          id: String(point.id),
          content: (point.payload?.content as string) || '',
          metadata: (point.payload?.metadata as DocumentChunk['metadata']) || {
            source: 'unknown',
          },
        },
      }));

      logger.debug(`Found ${results.length} similar documents in Qdrant`);
      return results;
    } catch (error) {
      logger.error('Failed to search in Qdrant:', error);
      throw new InternalServerError('Failed to search vector database', error);
    }
  }

  async getDocumentById(id: string): Promise<DocumentChunk | null> {
    try {
      const result = await this.client.retrieve(this.collectionName, {
        ids: [id],
        with_payload: true,
      });

      if (result.length === 0) {
        return null;
      }

      const point = result[0];
      if (!point) {
        return null;
      }

      return {
        id: String(point.id),
        content: (point.payload?.content as string) || '',
        metadata: (point.payload?.metadata as DocumentChunk['metadata']) || {
          source: 'unknown',
        },
      };
    } catch (error) {
      logger.error(`Failed to get document ${id} from Qdrant:`, error);
      throw new InternalServerError('Failed to retrieve document from vector database', error);
    }
  }

  async deleteDocument(id: string): Promise<boolean> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: [id],
      });

      logger.debug(`Deleted document ${id} from Qdrant`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete document ${id} from Qdrant:`, error);
      throw new InternalServerError('Failed to delete document from vector database', error);
    }
  }

  async getCollectionInfo(): Promise<{ count: number; status: string }> {
    try {
      const info = await this.client.getCollection(this.collectionName);
      return {
        count: info.points_count || 0,
        status: info.status || 'unknown',
      };
    } catch (error) {
      logger.error('Failed to get collection info from Qdrant:', error);
      return { count: 0, status: 'error' };
    }
  }

  async clearCollection(): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: [],
      });
      logger.info(`Cleared all documents from collection: ${this.collectionName}`);
    } catch (error) {
      logger.error('Failed to clear collection:', error);
      throw new InternalServerError('Failed to clear vector database collection', error);
    }
  }
}
