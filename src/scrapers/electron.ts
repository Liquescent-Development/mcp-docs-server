import { BaseScraper } from './base.js';
import { DocumentationEntry, ScraperConfig, ScraperResult } from '../types.js';
import { generateCacheKey } from '../utils/cache.js';

export class ElectronScraper extends BaseScraper {
  constructor(config: ScraperConfig) {
    super(config, 'electron');
    this.validateConfig();
  }

  async scrape(params: Record<string, any>): Promise<ScraperResult> {
    const errors: string[] = [];
    const entries: DocumentationEntry[] = [];

    try {
      // Determine what to scrape based on params
      if (params.apiName) {
        // Scrape specific API documentation
        const apiEntries = await this.scrapeApi(params.apiName, params.version);
        entries.push(...apiEntries);
      } else if (params.type === 'migration' && params.fromVersion && params.toVersion) {
        // Scrape migration guide
        const migrationEntries = await this.scrapeMigrationGuide(params.fromVersion, params.toVersion);
        entries.push(...migrationEntries);
      } else if (params.topic) {
        // Scrape examples for a topic
        const exampleEntries = await this.scrapeExamples(params.topic);
        entries.push(...exampleEntries);
      } else {
        // Default: scrape main documentation index
        const indexEntries = await this.scrapeDocumentationIndex();
        entries.push(...indexEntries);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to scrape Electron docs: ${errorMessage}`);
    }

    return {
      entries,
      source: this.source,
      scrapedAt: new Date(),
      errors: errors.length > 0 ? errors : undefined
    };
  }

  parse(html: string, url: string): DocumentationEntry[] {
    const parser = this.parseHtml(html, url);
    const entries: DocumentationEntry[] = [];

    // Parse API documentation structure
    const apiSections = parser.parseApiDocs({
      selectors: {
        title: '.page-title, h1',
        content: '.markdown-body',
        sections: '.api-section, .method-detail, .property-detail'
      }
    });

    for (const section of apiSections) {
      if (section.title && section.content) {
        entries.push(this.createEntry(
          section.title,
          section.content,
          url,
          'api',
          { parsedFrom: 'electron-docs' }
        ));
      }
    }

    // Parse code examples
    const examples = parser.parseCodeExamples();
    for (const example of examples) {
      if (example.code) {
        entries.push(this.createEntry(
          example.description || 'Code Example',
          example.code,
          url,
          'example',
          { 
            language: example.language || 'javascript',
            parsedFrom: 'electron-docs'
          }
        ));
      }
    }

    return entries;
  }

  getCacheKey(params: Record<string, any>): string {
    return generateCacheKey('electron', params);
  }

  private async scrapeApi(apiName: string, version?: string): Promise<DocumentationEntry[]> {
    const versionPath = version || 'latest';
    const apiUrl = `/docs/${versionPath}/api/${apiName.toLowerCase()}`;
    
    try {
      const html = await this.fetchHtml(apiUrl);
      return this.parse(html, new URL(apiUrl, this.config.baseUrl).toString());
    } catch (error) {
      // Try alternative URL patterns
      const alternativeUrl = `/docs/${versionPath}/api/${apiName}`;
      const html = await this.fetchHtml(alternativeUrl);
      return this.parse(html, new URL(alternativeUrl, this.config.baseUrl).toString());
    }
  }

  private async scrapeMigrationGuide(fromVersion: string, toVersion: string): Promise<DocumentationEntry[]> {
    const migrationUrl = `/docs/latest/breaking-changes`;
    const html = await this.fetchHtml(migrationUrl);
    const parser = this.parseHtml(html, new URL(migrationUrl, this.config.baseUrl).toString());
    
    const migrationGuides = parser.parseMigrationGuide();
    const entries: DocumentationEntry[] = [];

    // Filter guides for the requested version range
    for (const guide of migrationGuides) {
      if (this.isVersionInRange(fromVersion, guide.fromVersion, guide.toVersion) ||
          this.isVersionInRange(toVersion, guide.fromVersion, guide.toVersion)) {
        entries.push(this.createEntry(
          `Migration: ${guide.fromVersion} to ${guide.toVersion}`,
          guide.changes.join('\n\n'),
          new URL(migrationUrl, this.config.baseUrl).toString(),
          'migration',
          { fromVersion: guide.fromVersion, toVersion: guide.toVersion }
        ));
      }
    }

    return entries;
  }

  private async scrapeExamples(topic: string): Promise<DocumentationEntry[]> {
    const searchUrl = `/docs/latest/api/${topic.toLowerCase()}`;
    const html = await this.fetchHtml(searchUrl);
    
    const entries = this.parse(html, new URL(searchUrl, this.config.baseUrl).toString());
    
    // Filter to only example entries
    return entries.filter(entry => entry.type === 'example');
  }

  private async scrapeDocumentationIndex(): Promise<DocumentationEntry[]> {
    const indexUrl = '/docs/latest/api/';
    const html = await this.fetchHtml(indexUrl);
    const parser = this.parseHtml(html, new URL(indexUrl, this.config.baseUrl).toString());
    
    const entries: DocumentationEntry[] = [];
    
    // Parse the index page to get all API links
    parser.$('.api-index-list a, .sidebar-link').each((_, element) => {
      const $el = parser.$(element);
      const href = $el.attr('href');
      const title = $el.text().trim();
      
      if (href && title) {
        entries.push(this.createEntry(
          title,
          `API Reference: ${title}`,
          new URL(href, this.config.baseUrl).toString(),
          'api',
          { isIndex: true }
        ));
      }
    });
    
    return entries;
  }

  private isVersionInRange(version: string, fromVersion: string, toVersion: string): boolean {
    // Simple version comparison (could be improved with semver)
    const v = this.parseVersion(version);
    const from = this.parseVersion(fromVersion);
    const to = this.parseVersion(toVersion);
    
    return v >= from && v <= to;
  }

  private parseVersion(version: string): number {
    const parts = version.split('.').map(p => parseInt(p, 10));
    return parts[0] * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);
  }
}