# RAG Chatbot Backend

Production-grade RAG-powered chatbot backend with Express, TypeScript, and clean architecture.

## 🏗️ Architecture

### Clean Architecture Layers

```
src/
├── routes/          # HTTP endpoints and routing
├── controllers/     # Request handlers and validation
├── services/        # Business logic (RAG, LLM, Embeddings)
├── repositories/    # Data access layer (Qdrant, Redis)
├── utils/           # Shared utilities and middleware
├── config/          # Configuration management
├── types/           # TypeScript type definitions
└── scripts/         # Utility scripts
```

### Tech Stack

- **Runtime**: Node.js + Express + TypeScript
- **Vector DB**: Qdrant (for embeddings storage)
- **Cache**: Redis (for chat sessions with TTL)
- **LLM**: Google Gemini API
- **Embeddings**: Jina Embeddings API
- **Validation**: Express Validator + Zod
- **Logging**: Winston
- **Security**: Helmet + CORS + Rate Limiting

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose (recommended)
- API Keys: Google Gemini, Jina Embeddings

### Environment Setup

1. Copy environment template:

```bash
cp env.example .env
```

2. Fill in your API keys in `.env`:

```bash
GOOGLE_API_KEY=your_google_api_key_here
JINA_API_KEY=your_jina_api_key_here
# Other optional configs...
```

### Option 1: Docker Compose (Recommended)

```bash
# Start all services (app, qdrant, redis)
docker-compose up -d

# Populate database with news articles
docker-compose exec app npm run populate

# View logs
docker-compose logs -f app
```

### Option 2: Local Development

```bash
# Install dependencies
npm install

# Start Qdrant and Redis (using Docker)
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant:v1.7.4 &
docker run -p 6379:6379 redis:7-alpine &

# Start development server
npm run dev

# Populate database (in another terminal)
npm run populate
```

## 📡 API Endpoints

### Chat Endpoints

```http
POST /api/chat
Content-Type: application/json

{
  "session_id": "unique-session-id",
  "user_message": "What are the latest trends in AI?"
}
```

```http
GET /api/chat/history/:session_id
```

```http
POST /api/chat/clear/:session_id
```

### Utility Endpoints

```http
GET /api/health
GET /api/chat/stats
```

```http
POST /api/chat/search
Content-Type: application/json

{
  "query": "artificial intelligence",
  "limit": 10,
  "threshold": 0.7
}
```

## 🗄️ Database Schema

### Vector Database (Qdrant)

- **Collection**: `news_articles`
- **Vector Size**: 1024 (Jina embeddings)
- **Distance**: Cosine similarity
- **Payload**: Document chunks with metadata

### Cache (Redis)

- **Key Pattern**: `chat:session:{session_id}`
- **TTL**: 24 hours
- **Data**: JSON serialized chat sessions

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run format       # Format with Prettier
npm run populate     # Populate vector database
```

### Code Quality

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured with TypeScript rules
- **Prettier**: Code formatting
- **Path Aliases**: `@/` for src directory

### Testing Strategy

```bash
# Unit tests (to be implemented)
npm test

# Integration tests (to be implemented)
npm run test:integration
```

## 📊 Monitoring & Logging

### Logging

- **Development**: Console + File logging
- **Production**: Structured JSON logs
- **Files**: `logs/combined.log`, `logs/error.log`

### Health Checks

- **Endpoint**: `/api/health`
- **Docker**: Built-in healthcheck
- **Monitoring**: System stats at `/api/chat/stats`

## 🔒 Security Features

- **Helmet**: Security headers
- **CORS**: Configurable origins
- **Rate Limiting**: 100 requests per 15 minutes
- **Input Validation**: Request sanitization
- **Error Handling**: No sensitive data exposure

## 🚀 Deployment

### Docker Production

```bash
# Build and start
docker-compose -f docker-compose.yml up -d

# Scale the application
docker-compose up --scale app=3
```

### Cloud Deployment (Render/Railway)

1. Connect your GitHub repository
2. Set environment variables
3. Deploy with auto-scaling enabled

### Environment Variables

```bash
# Required
GOOGLE_API_KEY=your_key
JINA_API_KEY=your_key

# Optional
PORT=3001
NODE_ENV=production
QDRANT_URL=http://localhost:6333
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=https://your-frontend.vercel.app
```

## 🎯 Performance Optimization

### Caching Strategy

- **Chat Sessions**: Redis with 24h TTL
- **Vector Search**: Qdrant native caching
- **API Responses**: HTTP caching headers

### Scalability

- **Stateless Design**: Horizontal scaling ready
- **Connection Pooling**: Redis connection reuse
- **Batch Processing**: Embedding generation

## 🐛 Troubleshooting

### Common Issues

1. **API Key Errors**: Verify environment variables
2. **Connection Issues**: Check Qdrant/Redis connectivity
3. **Memory Issues**: Increase container limits
4. **Rate Limiting**: Implement exponential backoff

### Debug Mode

```bash
DEBUG=* npm run dev
```

### Health Check

```bash
curl http://localhost:3001/api/health
```

## 📈 Future Enhancements

- [ ] WebSocket support for real-time chat
- [ ] Multi-language support
- [ ] Advanced analytics and metrics
- [ ] A/B testing framework
- [ ] Automated testing suite
- [ ] Performance monitoring
- [ ] Auto-scaling configuration

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details.
