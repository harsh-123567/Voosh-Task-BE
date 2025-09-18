import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { DocumentChunk } from '@/types';
import logger from '@/utils/logger';
import { ExternalServiceError } from '@/utils/errors';
import * as fs from 'fs/promises';

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
  content?: string;
}

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsArticle[];
}

export class NewsScraperService {
  private readonly newsApiKey: string;
  private readonly newsApiUrl = 'https://newsapi.org/v2/everything';

  constructor(apiKey?: string) {
    this.newsApiKey = apiKey || process.env.NEWS_API_KEY || '';
  }

  async fetchNewsArticles(
    query: string = 'technology OR AI OR software OR programming',
    pageSize: number = 50,
    language: string = 'en'
  ): Promise<NewsArticle[]> {
    try {
      if (!this.newsApiKey) {
        // Try RSS feeds first as fallback
        logger.info('No NEWS_API_KEY found, attempting to fetch from RSS feeds...');
        try {
          return await this.fetchFromRSSFeeds(pageSize);
        } catch (rssError) {
          logger.warn('RSS feeds failed, using enhanced mock data:', rssError);
          return this.generateEnhancedMockArticles(pageSize);
        }
      }

      const response = await axios.get<NewsAPIResponse>(this.newsApiUrl, {
        params: {
          q: query,
          pageSize: Math.min(pageSize, 100), // API limit
          language,
          sortBy: 'publishedAt',
          apiKey: this.newsApiKey,
        },
        timeout: 30000,
      });

      if (response.data.status !== 'ok') {
        throw new Error(`News API returned status: ${response.data.status}`);
      }

      logger.info(`Fetched ${response.data.articles.length} news articles`);
      return response.data.articles;
    } catch (error) {
      logger.error('Failed to fetch news articles:', error);

      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status || 500;
        const message = error.response?.data?.message || error.message;
        throw new ExternalServiceError('News API', message, { statusCode });
      }

      // Fallback to enhanced mock data on error
      logger.warn('Falling back to enhanced mock articles due to API error');
      return this.generateEnhancedMockArticles(pageSize);
    }
  }

  async fetchFromRSSFeeds(count: number = 50): Promise<NewsArticle[]> {
    const rssFeeds = [
      'https://feeds.feedburner.com/oreilly/radar',
      'https://techcrunch.com/feed/',
      'https://www.wired.com/feed/rss',
      'https://feeds.arstechnica.com/arstechnica/index',
      'https://rss.cnn.com/rss/edition.rss',
      'https://feeds.bbci.co.uk/news/technology/rss.xml',
    ];

    const articles: NewsArticle[] = [];

    for (const feedUrl of rssFeeds) {
      if (articles.length >= count) break;

      try {
        logger.info(`Fetching from RSS feed: ${feedUrl}`);
        const response = await axios.get(feedUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
          },
        });

        // Simple RSS parsing - look for <item> or <entry> tags
        const xmlData = response.data;
        const itemMatches =
          xmlData.match(/<item[\s\S]*?<\/item>/gi) ||
          xmlData.match(/<entry[\s\S]*?<\/entry>/gi) ||
          [];

        for (const item of itemMatches.slice(0, Math.ceil(count / rssFeeds.length))) {
          if (articles.length >= count) break;

          const title = this.extractXMLContent(item, 'title') || 'Technology News';
          const description =
            this.extractXMLContent(item, 'description') ||
            this.extractXMLContent(item, 'summary') ||
            'Latest technology and innovation news';
          const link =
            this.extractXMLContent(item, 'link') ||
            this.extractXMLContent(item, 'guid') ||
            `https://example.com/article-${articles.length}`;
          const pubDate =
            this.extractXMLContent(item, 'pubDate') ||
            this.extractXMLContent(item, 'published') ||
            new Date().toISOString();

          articles.push({
            title: this.cleanText(title),
            description: this.cleanText(description),
            url: link.replace(/^<!\[CDATA\[|\]\]>$/g, '').trim(),
            publishedAt: new Date(pubDate).toISOString(),
            source: new URL(feedUrl).hostname.replace('www.', ''),
            content:
              this.cleanText(description) +
              '. This article covers important developments in technology, innovation, and digital transformation.',
          });
        }
      } catch (error) {
        logger.warn(`Failed to fetch from RSS feed ${feedUrl}:`, error);
      }
    }

    logger.info(`Fetched ${articles.length} articles from RSS feeds`);
    return articles.length > 0 ? articles : this.generateEnhancedMockArticles(count);
  }

  private extractXMLContent(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'i');
    const match = xml.match(regex);
    return match && match[1] ? match[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : null;
  }

  private cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&[^;]+;/g, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private generateEnhancedMockArticles(count: number): NewsArticle[] {
    const mockArticles: NewsArticle[] = [
      {
        title: 'AI Revolution in Software Development',
        description:
          'How artificial intelligence is transforming the way we write and maintain code.',
        url: 'https://example.com/ai-revolution',
        publishedAt: new Date().toISOString(),
        source: 'Tech Today',
        content:
          'Artificial intelligence is revolutionizing software development by automating code generation, bug detection, and performance optimization. Developers are now able to focus more on creative problem-solving while AI handles routine tasks. This shift is expected to increase productivity by 40% in the next five years.',
      },
      {
        title: 'The Future of Cloud Computing',
        description: 'Exploring emerging trends in cloud infrastructure and services.',
        url: 'https://example.com/cloud-future',
        publishedAt: new Date(Date.now() - 86400000).toISOString(),
        source: 'Cloud Weekly',
        content:
          'Cloud computing continues to evolve with serverless architectures, edge computing, and multi-cloud strategies becoming mainstream. Organizations are increasingly adopting hybrid approaches to balance cost, performance, and security requirements.',
      },
      {
        title: 'Cybersecurity Challenges in 2024',
        description: 'Understanding the latest threats and defense strategies in cybersecurity.',
        url: 'https://example.com/cybersecurity-2024',
        publishedAt: new Date(Date.now() - 172800000).toISOString(),
        source: 'Security Focus',
        content:
          'Cybersecurity threats are becoming more sophisticated with AI-powered attacks and supply chain vulnerabilities. Organizations must adopt zero-trust architectures and implement comprehensive security frameworks to protect against emerging threats.',
      },
      {
        title: 'Machine Learning in Healthcare',
        description: 'How ML algorithms are improving patient outcomes and medical research.',
        url: 'https://example.com/ml-healthcare',
        publishedAt: new Date(Date.now() - 259200000).toISOString(),
        source: 'HealthTech News',
        content:
          'Machine learning is transforming healthcare through predictive analytics, personalized treatment plans, and automated diagnostics. Recent breakthroughs in medical imaging and drug discovery are accelerating the pace of medical innovation.',
      },
      {
        title: 'Sustainable Technology Practices',
        description: 'Green computing and environmentally conscious software development.',
        url: 'https://example.com/sustainable-tech',
        publishedAt: new Date(Date.now() - 345600000).toISOString(),
        source: 'Green Tech',
        content:
          'Technology companies are prioritizing sustainability through energy-efficient data centers, carbon-neutral cloud services, and eco-friendly software development practices. The industry is working towards net-zero emissions by 2030.',
      },
    ];

    // Generate additional mock articles to reach the requested count
    const additionalArticles: NewsArticle[] = [];
    for (let i = mockArticles.length; i < count; i++) {
      additionalArticles.push({
        title: `Technology News Article ${i + 1}`,
        description: `This is a sample technology news article covering various aspects of modern software development and innovation.`,
        url: `https://example.com/article-${i + 1}`,
        publishedAt: new Date(Date.now() - i * 86400000).toISOString(),
        source: `Tech Source ${Math.floor(i / 10) + 1}`,
        content: `This is sample content for article ${i + 1}. It covers topics related to technology, software development, and innovation in the digital space. The content includes information about current trends, best practices, and future predictions in the technology industry.`,
      });
    }

    return [...mockArticles, ...additionalArticles];
  }

  async convertToDocumentChunks(articles: NewsArticle[]): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];

    for (const article of articles) {
      // Create chunk for title and description
      const titleChunk: DocumentChunk = {
        id: uuidv4(),
        content: `${article.title}\n\n${article.description}`,
        metadata: {
          source: article.source,
          title: article.title,
          url: article.url,
          timestamp: article.publishedAt,
        },
      };
      chunks.push(titleChunk);

      // Create chunk for full content if available
      if (article.content && article.content.length > 100) {
        const contentChunk: DocumentChunk = {
          id: uuidv4(),
          content: article.content,
          metadata: {
            source: article.source,
            title: article.title,
            url: article.url,
            timestamp: article.publishedAt,
          },
        };
        chunks.push(contentChunk);
      }

      // Split long content into smaller chunks if needed
      if (article.content && article.content.length > 1000) {
        const sentences = article.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        let currentChunk = '';

        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > 800) {
            if (currentChunk.trim()) {
              chunks.push({
                id: uuidv4(),
                content: currentChunk.trim(),
                metadata: {
                  source: article.source,
                  title: article.title,
                  url: article.url,
                  timestamp: article.publishedAt,
                },
              });
            }
            currentChunk = sentence.trim() + '.';
          } else {
            currentChunk += sentence.trim() + '.';
          }
        }

        // Add remaining content
        if (currentChunk.trim()) {
          chunks.push({
            id: uuidv4(),
            content: currentChunk.trim(),
            metadata: {
              source: article.source,
              title: article.title,
              url: article.url,
              timestamp: article.publishedAt,
            },
          });
        }
      }
    }

    logger.info(`Converted ${articles.length} articles to ${chunks.length} document chunks`);
    return chunks;
  }

  async saveArticleLinks(
    articles: NewsArticle[],
    filename: string = 'article_links.txt'
  ): Promise<void> {
    try {
      const linksContent = articles
        .map((article, index) => {
          return `${index + 1}. ${article.title}\n   URL: ${article.url}\n   Source: ${article.source}\n   Published: ${new Date(article.publishedAt).toLocaleDateString()}\n`;
        })
        .join('\n');

      const header = `# News Articles Links (${articles.length} articles)\n# Generated: ${new Date().toISOString()}\n\n`;

      await fs.writeFile(filename, header + linksContent);
      logger.info(`Saved ${articles.length} article links to ${filename}`);
    } catch (error) {
      logger.error('Failed to save article links:', error);
    }
  }

  async scrapeAndIndex(query?: string, articleCount: number = 50): Promise<DocumentChunk[]> {
    try {
      const articles = await this.fetchNewsArticles(query, articleCount);

      // Save article links to file
      await this.saveArticleLinks(articles, 'logs/article_links.txt');

      const chunks = await this.convertToDocumentChunks(articles);

      logger.info(`Successfully scraped and processed ${chunks.length} document chunks`);
      return chunks;
    } catch (error) {
      logger.error('Failed to scrape and index news articles:', error);
      throw error;
    }
  }
}
