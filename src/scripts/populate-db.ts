import { NewsScraperService } from '@/services/newsScraper';
import { RAGService } from '@/services/rag';
import logger from '@/utils/logger';

async function populateDatabase(): Promise<void> {
  const scraper = new NewsScraperService();
  const ragService = new RAGService();

  try {
    logger.info('Starting database population...');

    // Initialize RAG service
    await ragService.initialize();

    // Scrape news articles
    const chunks = await scraper.scrapeAndIndex(
      'technology OR software OR programming OR AI OR cloud OR cybersecurity',
      50
    );

    // Index documents in vector database
    await ragService.indexDocuments(chunks);

    logger.info('Database population completed successfully!');

    // Get stats
    const stats = await ragService.getSystemStats();
    logger.info('System stats:', stats);
  } catch (error) {
    logger.error('Failed to populate database:', error);
    process.exit(1);
  } finally {
    await ragService.cleanup();
  }
}

// Run if called directly
if (require.main === module) {
  populateDatabase()
    .then(() => {
      logger.info('Database population script finished');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Database population script failed:', error);
      process.exit(1);
    });
}

export { populateDatabase };
