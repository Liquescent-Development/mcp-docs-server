import { GetApiReferenceParams, GetApiReferenceSchema, DocumentationEntry } from '../types.js';
import { DocumentationCache } from '../cache/index.js';
import { ElectronScraper, ReactScraper, NodeScraper, GitHubScraper } from '../scrapers/index.js';
import { logToolActivity } from '../utils/logger.js';
import { generateCacheKey } from '../utils/cache.js';

export class DocumentationTool {
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

  async getApiReference(params: GetApiReferenceParams): Promise<DocumentationEntry | null> {
    logToolActivity('get_api_reference', params);

    const cacheKey = generateCacheKey('api_ref', params);
    const cached = await this.cache.get<DocumentationEntry>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const scraper = this.scrapers.get(params.source);
    if (!scraper) {
      throw new Error(`Scraper not configured for source: ${params.source}`);
    }

    try {
      const result = await scraper.scrape({
        apiName: params.apiName,
        version: params.version
      });

      if (result.entries && result.entries.length > 0) {
        // Return the most relevant entry
        const entry = this.findBestMatch(result.entries, params.apiName);
        
        if (entry) {
          // Cache the result
          await this.cache.set(cacheKey, entry, 3600); // Cache for 1 hour
          return entry;
        }
      }

      return null;
    } catch (error) {
      logToolActivity('get_api_reference', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private findBestMatch(entries: DocumentationEntry[], apiName: string): DocumentationEntry | null {
    const apiNameLower = apiName.toLowerCase();
    
    // First try exact match
    const exactMatch = entries.find(entry => 
      entry.title.toLowerCase() === apiNameLower
    );
    if (exactMatch) return exactMatch;

    // Then try contains match
    const containsMatch = entries.find(entry => 
      entry.title.toLowerCase().includes(apiNameLower)
    );
    if (containsMatch) return containsMatch;

    // Finally, try partial match
    const partialMatch = entries.find(entry => {
      const titleLower = entry.title.toLowerCase();
      return apiNameLower.split(/[.-_]/).some(part => titleLower.includes(part));
    });
    
    return partialMatch || entries[0] || null;
  }

  getSchema() {
    return GetApiReferenceSchema;
  }
}