import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import config from '@/config';
import logger from '@/utils/logger';
import { DocumentChunk, ChatMessage } from '@/types';
import { ExternalServiceError } from '@/utils/errors';

export class LLMService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.googleApiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 2048,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });
  }

  async generateResponse(
    userQuery: string,
    retrievedChunks: DocumentChunk[],
    chatHistory: ChatMessage[] = []
  ): Promise<string> {
    try {
      const context = this.buildContext(retrievedChunks);
      const conversationHistory = this.formatChatHistory(chatHistory);

      const systemPrompt = `You are an intelligent assistant that answers questions based on provided news articles context. 

INSTRUCTIONS:
1. Use ONLY the information provided in the context to answer questions
2. If the context doesn't contain enough information, clearly state what's missing
3. Provide accurate, concise, and helpful responses
4. Cite sources when possible by mentioning the article titles or sources
5. If asked about current events, remind users that information is based on the provided articles
6. Be conversational but professional
7. If no relevant information is found, politely explain this limitation

CONTEXT:
${context}

CONVERSATION HISTORY:
${conversationHistory}

USER QUESTION: ${userQuery}

Please provide a helpful response based on the context provided.`;

      const result = await this.model.generateContent(systemPrompt);
      const response = await result.response;
      const text = response.text();

      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from Gemini API');
      }

      logger.debug(`Generated response for query: ${userQuery.slice(0, 100)}...`);
      return text.trim();
    } catch (error) {
      logger.error('Failed to generate LLM response:', error);

      if (error instanceof Error) {
        throw new ExternalServiceError('Gemini API', error.message, error);
      }

      throw new ExternalServiceError('Gemini API', 'Unknown error occurred');
    }
  }

  private buildContext(chunks: DocumentChunk[]): string {
    if (chunks.length === 0) {
      return 'No relevant articles found for this query.';
    }

    return chunks
      .map((chunk, index) => {
        const source = chunk.metadata.title || chunk.metadata.source || 'Unknown Source';
        const url = chunk.metadata.url ? ` (${chunk.metadata.url})` : '';
        const timestamp = chunk.metadata.timestamp ? ` - ${chunk.metadata.timestamp}` : '';

        return `
Article ${index + 1}: ${source}${url}${timestamp}
Content: ${chunk.content}
---`;
      })
      .join('\n');
  }

  private formatChatHistory(messages: ChatMessage[]): string {
    if (messages.length === 0) {
      return 'No previous conversation.';
    }

    // Get last 10 messages to avoid token limits
    const recentMessages = messages.slice(-10);

    return recentMessages.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n');
  }

  async generateSummary(text: string, maxLength: number = 200): Promise<string> {
    try {
      const prompt = `Please provide a concise summary of the following text in approximately ${maxLength} characters:

${text}

Summary:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();

      logger.debug(`Generated summary of length: ${summary.length}`);
      return summary.trim();
    } catch (error) {
      logger.error('Failed to generate summary:', error);
      throw new ExternalServiceError('Gemini API', 'Failed to generate summary');
    }
  }

  async extractKeywords(text: string): Promise<string[]> {
    try {
      const prompt = `Extract the most important keywords and phrases from the following text. Return them as a comma-separated list:

${text}

Keywords:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const keywordsText = response.text();

      const keywords = keywordsText
        .split(',')
        .map((keyword: string) => keyword.trim())
        .filter((keyword: string) => keyword.length > 0)
        .slice(0, 10); // Limit to 10 keywords

      logger.debug(`Extracted ${keywords.length} keywords`);
      return keywords;
    } catch (error) {
      logger.error('Failed to extract keywords:', error);
      return [];
    }
  }
}
