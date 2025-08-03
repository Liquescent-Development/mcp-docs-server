import { FindExamplesParams, FindExamplesSchema, DocumentationEntry } from '../types.js';
import { DocumentationCache } from '../cache/index.js';
import { ElectronScraper, ReactScraper, NodeScraper, GitHubScraper } from '../scrapers/index.js';
import { logToolActivity } from '../utils/logger.js';
import { generateCacheKey } from '../utils/cache.js';

export class ExamplesTool {
  private cache: DocumentationCache;
  private scrapers: Map<string, any>;

  constructor(cache: DocumentationCache, scraperConfigs: Record<string, any>) {
    this.cache = cache;
    this.scrapers = new Map();

    // Initialize scrapers
    if (scraperConfigs.electron) {
      this.scrapers.set('electron', new ElectronScraper(scraperConfigs.electron));
    }
    if (scraperConfigs.react) {
      this.scrapers.set('react', new ReactScraper(scraperConfigs.react));
    }
    if (scraperConfigs.node) {
      this.scrapers.set('node', new NodeScraper(scraperConfigs.node));
    }
    if (scraperConfigs.github) {
      this.scrapers.set('github', new GitHubScraper(scraperConfigs.github));
    }
  }

  async findExamples(params: FindExamplesParams): Promise<DocumentationEntry[]> {
    logToolActivity('find_examples', params);

    const cacheKey = generateCacheKey('examples', params);
    const cached = await this.cache.get<DocumentationEntry[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const sources = params.sources || Array.from(this.scrapers.keys());
    const allExamples: DocumentationEntry[] = [];
    const errors: string[] = [];

    // Search for examples across sources
    await Promise.all(
      sources.map(async (source) => {
        const scraper = this.scrapers.get(source);
        if (!scraper) {
          errors.push(`Scraper not configured for source: ${source}`);
          return;
        }

        try {
          const result = await scraper.scrape({
            topic: params.topic,
            type: 'example'
          });

          if (result.entries) {
            const examples = result.entries.filter((entry: DocumentationEntry) => entry.type === 'example');
            allExamples.push(...examples);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to find examples in ${source}: ${errorMessage}`);
        }
      })
    );

    // Filter by language if specified
    let filteredExamples = allExamples;
    if (params.language) {
      filteredExamples = allExamples.filter(example => {
        const lang = example.metadata?.language;
        return lang && lang.toLowerCase() === params.language!.toLowerCase();
      });
    }

    // Rank examples by relevance
    const rankedExamples = this.rankExamples(filteredExamples, params.topic);

    // Apply limit
    const limitedExamples = rankedExamples.slice(0, params.limit);

    // Cache the result
    await this.cache.set(cacheKey, limitedExamples, 1800); // Cache for 30 minutes

    if (errors.length > 0) {
      logToolActivity('find_examples', { errors });
    }

    return limitedExamples;
  }

  private rankExamples(examples: DocumentationEntry[], topic: string): DocumentationEntry[] {
    const topicLower = topic.toLowerCase();
    const topicTerms = topicLower.split(/\s+/);

    return examples
      .map(example => {
        let score = 0;
        const titleLower = example.title.toLowerCase();
        const contentLower = example.content.toLowerCase();

        // Exact topic match in title
        if (titleLower.includes(topicLower)) {
          score += 50;
        }

        // Term matches
        topicTerms.forEach(term => {
          if (titleLower.includes(term)) score += 20;
          if (contentLower.includes(term)) score += 5;
        });

        // Prefer examples with descriptions
        if (example.metadata?.description) {
          score += 10;
        }

        // Prefer examples from official sources
        if (example.source !== 'github') {
          score += 15;
        }

        return { example, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ example }) => example);
  }

  getSchema() {
    return FindExamplesSchema;
  }
}