import { SearchDocumentationParams, SearchDocumentationSchema, SearchResult, DocumentationEntry } from '../types.js';
import { DocumentationCache } from '../cache/index.js';
import { ElectronScraper, ReactScraper, NodeScraper, GitHubScraper } from '../scrapers/index.js';
import { logToolActivity } from '../utils/logger.js';
import { generateCacheKey } from '../utils/cache.js';

export class SearchTool {
  private cache: DocumentationCache;
  private scrapers: Map<string, any>;

  constructor(cache: DocumentationCache, scraperConfigs: Record<string, any>) {
    this.cache = cache;
    this.scrapers = new Map();

    // Initialize scrapers based on configuration
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

  async search(params: SearchDocumentationParams): Promise<SearchResult> {
    logToolActivity('search_documentation', params);

    const cacheKey = generateCacheKey('search', params);
    const cached = await this.cache.get<SearchResult>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const sources = params.sources || Array.from(this.scrapers.keys());
    const allEntries: DocumentationEntry[] = [];
    const errors: string[] = [];

    // Search across specified sources
    await Promise.all(
      sources.map(async (source) => {
        const scraper = this.scrapers.get(source);
        if (!scraper) {
          errors.push(`Scraper not configured for source: ${source}`);
          return;
        }

        try {
          // Scrape with search parameters
          const result = await scraper.scrape({
            query: params.query,
            type: params.type
          });

          if (result.entries) {
            allEntries.push(...result.entries);
          }
          if (result.errors) {
            errors.push(...result.errors);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to search ${source}: ${errorMessage}`);
        }
      })
    );

    // Filter and rank results
    const filteredEntries = this.filterAndRankEntries(
      allEntries,
      params.query,
      params.type
    );

    // Apply limit
    const limitedEntries = filteredEntries.slice(0, params.limit);

    const result: SearchResult = {
      entries: limitedEntries,
      totalCount: filteredEntries.length,
      query: params.query,
      sources
    };

    // Cache the result
    await this.cache.set(cacheKey, result, 1800); // Cache for 30 minutes

    if (errors.length > 0) {
      logToolActivity('search_documentation', { errors });
    }

    return result;
  }

  private filterAndRankEntries(
    entries: DocumentationEntry[],
    query: string,
    type?: DocumentationEntry['type']
  ): DocumentationEntry[] {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/);

    return entries
      .filter(entry => {
        // Filter by type if specified
        if (type && entry.type !== type) {
          return false;
        }

        // Check if query matches title or content
        const titleLower = entry.title.toLowerCase();
        const contentLower = entry.content.toLowerCase();

        return queryTerms.every(term =>
          titleLower.includes(term) || contentLower.includes(term)
        );
      })
      .map(entry => {
        // Calculate relevance score
        const titleLower = entry.title.toLowerCase();
        const contentLower = entry.content.toLowerCase();
        let score = 0;

        // Exact match in title
        if (titleLower === queryLower) {
          score += 100;
        }
        
        // Title contains query
        if (titleLower.includes(queryLower)) {
          score += 50;
        }

        // Count term occurrences
        queryTerms.forEach(term => {
          const titleMatches = (titleLower.match(new RegExp(term, 'g')) || []).length;
          const contentMatches = (contentLower.match(new RegExp(term, 'g')) || []).length;
          
          score += titleMatches * 10;
          score += contentMatches * 2;
        });

        return { entry, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ entry }) => entry);
  }

  getSchema() {
    return SearchDocumentationSchema;
  }
}