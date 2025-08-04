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
      } else if (params.query) {
        // Handle search queries - try to find relevant API pages
        const searchEntries = await this.scrapeSearchQuery(params.query);
        entries.push(...searchEntries);
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

    // Handle modern Electron docs structure (Docusaurus-based)
    const title = parser.$('h1').first().text().trim() || 
                  parser.$('[data-rh="true"] title').text().split(' | ')[0] ||
                  'Electron Documentation';
    
    // Extract main content from the documentation page
    let content = '';
    
    // Try different content containers
    const contentSelectors = [
      '.theme-doc-markdown.markdown',
      '.markdown',
      'main .container',
      'article',
      '.docItemContainer_Djhp'
    ];
    
    for (const selector of contentSelectors) {
      const contentElement = parser.$(selector);
      if (contentElement.length > 0) {
        content = parser.extractContent(contentElement);
        break;
      }
    }
    
    // If no content found with selectors, get text content from body
    if (!content) {
      // Remove navigation, headers, footers, and script elements
      parser.$('nav, header, footer, script, style, .navbar, .sidebar, .breadcrumbs').remove();
      content = parser.$('body').text().trim();
      
      // Clean up excessive whitespace
      content = content.replace(/\s+/g, ' ').substring(0, 5000);
    }

    if (title && content && content.length > 50) {
      entries.push(this.createEntry(
        title,
        content,
        url,
        'api',
        { parsedFrom: 'electron-docs-modern' }
      ));
    }

    // Parse code examples from pre/code blocks
    const examples = parser.parseCodeExamples();
    for (const example of examples) {
      if (example.code && example.code.length > 10) {
        entries.push(this.createEntry(
          example.description || `Code Example from ${title}`,
          example.code,
          url,
          'example',
          { 
            language: example.language || 'javascript',
            parsedFrom: 'electron-docs-modern'
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
    
    // Try different API name formats
    const possibleNames = [
      apiName.toLowerCase(),
      apiName.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase(), // camelCase to kebab-case
      apiName
    ];
    
    for (const name of possibleNames) {
      try {
        const apiUrl = `/docs/${versionPath}/api/${name}`;
        const html = await this.fetchHtml(apiUrl);
        return this.parse(html, new URL(apiUrl, this.config.baseUrl).toString());
      } catch (error) {
        // Try next format
        continue;
      }
    }
    
    // If all formats fail, return empty array
    return [];
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

  private async scrapeSearchQuery(query: string): Promise<DocumentationEntry[]> {
    const queryLower = query.toLowerCase();
    const entries: DocumentationEntry[] = [];
    
    // Map common search terms to specific API endpoints
    const queryToApiMap: Record<string, string[]> = {
      'app': ['app'],
      'window': ['browser-window'],
      'browserwindow': ['browser-window'],
      'browser': ['browser-window'],
      'web': ['web-contents'],
      'webcontents': ['web-contents'],
      'menu': ['menu'],
      'dialog': ['dialog'],
      'ipc': ['ipc-main', 'ipc-renderer'],
      'main': ['ipc-main'],
      'process': ['process'],
      'shell': ['shell'],
      'clipboard': ['clipboard'],
      'screen': ['screen'],
      'notification': ['notification'],
      'tray': ['tray']
    };
    
    // Find relevant APIs based on the query
    const relevantApis = new Set<string>();
    
    // Direct matches
    for (const [term, apis] of Object.entries(queryToApiMap)) {
      if (queryLower.includes(term)) {
        apis.forEach(api => relevantApis.add(api));
      }
    }
    
    // If no specific matches, try common APIs
    if (relevantApis.size === 0) {
      ['app', 'browser-window', 'web-contents'].forEach(api => relevantApis.add(api));
    }
    
    // Scrape the relevant API pages
    for (const apiName of Array.from(relevantApis)) {
      try {
        const apiUrl = `/docs/latest/api/${apiName}`;
        const html = await this.fetchHtml(apiUrl);
        const parsed = this.parse(html, new URL(apiUrl, this.config.baseUrl).toString());
        entries.push(...parsed);
      } catch (error) {
        // Skip APIs that don't exist or can't be fetched
        continue;
      }
    }
    
    return entries;
  }

  private async scrapeDocumentationIndex(): Promise<DocumentationEntry[]> {
    // Try common API endpoints that we know exist
    const commonApis = ['app', 'browser-window', 'web-contents', 'menu', 'dialog'];
    const entries: DocumentationEntry[] = [];
    
    for (const apiName of commonApis) {
      try {
        const apiUrl = `/docs/latest/api/${apiName}`;
        const html = await this.fetchHtml(apiUrl);
        const parsed = this.parse(html, new URL(apiUrl, this.config.baseUrl).toString());
        entries.push(...parsed);
      } catch (error) {
        // Skip APIs that don't exist or can't be fetched
        continue;
      }
    }
    
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