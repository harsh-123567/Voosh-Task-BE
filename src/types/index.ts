export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatRequest {
  session_id: string;
  user_message: string;
}

export interface ChatResponse {
  message: string;
  session_id: string;
  message_id: string;
  sources?: DocumentChunk[];
}

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    title?: string;
    url?: string;
    timestamp?: string;
  };
  score?: number;
}

export interface EmbeddingRequest {
  texts: string[];
}

export interface EmbeddingResponse {
  embeddings: number[][];
}

export interface VectorSearchResult {
  id: string;
  score: number;
  payload: DocumentChunk;
}

export interface RAGContext {
  query: string;
  retrievedChunks: DocumentChunk[];
  response: string;
}

export interface APIError {
  message: string;
  code: string;
  statusCode: number;
  details?: unknown;
}

export interface Config {
  port: number;
  nodeEnv: string;
  googleApiKey: string;
  qdrant: {
    url: string;
    apiKey?: string | undefined;
  };
  redis: {
    url: string;
    password?: string | undefined;
  };
  jinaApiKey: string;
  corsOrigin: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}
