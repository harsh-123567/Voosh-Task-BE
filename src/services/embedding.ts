import axios from 'axios';
import config from '@/config';
import logger from '@/utils/logger';
import { EmbeddingRequest, EmbeddingResponse } from '@/types';
import { ExternalServiceError } from '@/utils/errors';

export class EmbeddingService {
  private readonly apiUrl = 'https://api.jina.ai/v1/embeddings';
  private readonly model = 'jina-embeddings-v2-base-en';

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      if (texts.length === 0) {
        return [];
      }

      const request: EmbeddingRequest = {
        texts: texts.map(text => text.slice(0, 8192)), // Limit text length
      };

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          input: request.texts,
        },
        {
          headers: {
            Authorization: `Bearer ${config.jinaApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 seconds timeout
        }
      );

      // Handle different response formats
      let embeddings: number[][];
      if (response.data.data && Array.isArray(response.data.data)) {
        embeddings = response.data.data.map((item: any) => item.embedding);
      } else if (response.data.embeddings && Array.isArray(response.data.embeddings)) {
        embeddings = response.data.embeddings;
      } else {
        throw new Error('No embeddings returned from Jina API');
      }

      logger.debug(`Generated embeddings for ${texts.length} texts`);
      return embeddings;
    } catch (error) {
      logger.error('Failed to generate embeddings:', error);

      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status || 500;
        const message = error.response?.data?.message || error.message;
        throw new ExternalServiceError('Jina Embeddings API', message, {
          statusCode,
          originalError: error.message,
        });
      }

      throw new ExternalServiceError('Jina Embeddings API', 'Unknown error occurred');
    }
  }

  async generateSingleEmbedding(text: string): Promise<number[]> {
    const embeddings = await this.generateEmbeddings([text]);
    return embeddings[0] || [];
  }

  async batchEmbeddings(texts: string[], batchSize: number = 10): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await this.generateEmbeddings(batch);
      results.push(...batchEmbeddings);

      // Small delay to avoid rate limiting
      if (i + batchSize < texts.length) {
        await new Promise(resolve => {
          setTimeout(resolve, 100);
        });
      }
    }

    logger.info(`Generated embeddings for ${texts.length} texts in batches`);
    return results;
  }

  validateEmbedding(embedding: number[]): boolean {
    return (
      Array.isArray(embedding) &&
      embedding.length === 768 && // Jina embeddings dimension
      embedding.every(val => typeof val === 'number' && !isNaN(val))
    );
  }
}
