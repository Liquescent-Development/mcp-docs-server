import { GetMigrationGuideParams, GetMigrationGuideSchema, DocumentationEntry } from '../types.js';
import { DocumentationCache } from '../cache/index.js';
import { ElectronScraper, ReactScraper, NodeScraper, GitHubScraper } from '../scrapers/index.js';
import { logToolActivity } from '../utils/logger.js';
import { generateCacheKey } from '../utils/cache.js';

export class MigrationTool {
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

  async getMigrationGuide(params: GetMigrationGuideParams): Promise<DocumentationEntry[]> {
    logToolActivity('get_migration_guide', params);

    const cacheKey = generateCacheKey('migration', params);
    const cached = await this.cache.get<DocumentationEntry[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const scraper = this.scrapers.get(params.source);
    if (!scraper) {
      throw new Error(`Scraper not configured for source: ${params.source}`);
    }

    try {
      const result = await scraper.scrape({
        type: 'migration',
        fromVersion: params.fromVersion,
        toVersion: params.toVersion
      });

      if (result.entries) {
        const migrationEntries = result.entries.filter((entry: DocumentationEntry) => entry.type === 'migration');
        
        // Cache the result
        await this.cache.set(cacheKey, migrationEntries, 7200); // Cache for 2 hours
        
        return migrationEntries;
      }

      return [];
    } catch (error) {
      logToolActivity('get_migration_guide', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  getSchema() {
    return GetMigrationGuideSchema;
  }
}