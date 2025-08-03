import { BaseScraper } from './base.js';
import { DocumentationEntry, ScraperConfig, ScraperResult } from '../types.js';
import { generateCacheKey } from '../utils/cache.js';

export class ReactScraper extends BaseScraper {
  constructor(config: ScraperConfig) {
    super(config, 'react');
    this.validateConfig();
  }

  async scrape(params: Record<string, any>): Promise<ScraperResult> {
    const errors: string[] = [];
    const entries: DocumentationEntry[] = [];

    try {
      if (params.apiName) {
        const apiEntries = await this.scrapeApi(params.apiName);
        entries.push(...apiEntries);
      } else if (params.topic) {
        const exampleEntries = await this.scrapeExamples(params.topic);
        entries.push(...exampleEntries);
      } else if (params.type === 'migration') {
        const migrationEntries = await this.scrapeMigrationGuide(params.fromVersion, params.toVersion);
        entries.push(...migrationEntries);
      } else {
        const indexEntries = await this.scrapeDocumentationIndex();
        entries.push(...indexEntries);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to scrape React docs: ${errorMessage}`);
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

    // Parse React documentation structure
    const apiSections = parser.parseApiDocs({
      selectors: {
        title: 'h1, h2',
        content: '.markdown, article',
        sections: '.api-doc, .reference-doc'
      }
    });

    for (const section of apiSections) {
      if (section.title && section.content) {
        entries.push(this.createEntry(
          section.title,
          section.content,
          url,
          'api',
          { parsedFrom: 'react-docs' }
        ));
      }
    }

    // Parse code examples
    const examples = parser.parseCodeExamples();
    for (const example of examples) {
      if (example.code) {
        entries.push(this.createEntry(
          example.description || 'React Example',
          example.code,
          url,
          'example',
          { 
            language: example.language || 'jsx',
            parsedFrom: 'react-docs'
          }
        ));
      }
    }

    return entries;
  }

  getCacheKey(params: Record<string, any>): string {
    return generateCacheKey('react', params);
  }

  private async scrapeApi(apiName: string): Promise<DocumentationEntry[]> {
    const apiUrl = `/reference/react/${apiName.toLowerCase()}`;
    const html = await this.fetchHtml(apiUrl);
    return this.parse(html, new URL(apiUrl, this.config.baseUrl).toString());
  }

  private async scrapeMigrationGuide(fromVersion: string, toVersion: string): Promise<DocumentationEntry[]> {
    const migrationUrl = '/blog/2022/03/08/react-18-upgrade-guide';
    const html = await this.fetchHtml(migrationUrl);
    const entries = this.parse(html, new URL(migrationUrl, this.config.baseUrl).toString());
    
    return entries.map(entry => ({
      ...entry,
      type: 'migration' as const,
      metadata: { ...entry.metadata, fromVersion, toVersion }
    }));
  }

  private async scrapeExamples(topic: string): Promise<DocumentationEntry[]> {
    const searchUrl = `/learn/${topic.toLowerCase()}`;
    const html = await this.fetchHtml(searchUrl);
    const entries = this.parse(html, new URL(searchUrl, this.config.baseUrl).toString());
    
    return entries.filter(entry => entry.type === 'example');
  }

  private async scrapeDocumentationIndex(): Promise<DocumentationEntry[]> {
    const indexUrl = '/reference/react';
    const html = await this.fetchHtml(indexUrl);
    const parser = this.parseHtml(html, new URL(indexUrl, this.config.baseUrl).toString());
    
    const entries: DocumentationEntry[] = [];
    
    parser.$('nav a, .reference-index a').each((_, element) => {
      const $el = parser.$(element);
      const href = $el.attr('href');
      const title = $el.text().trim();
      
      if (href && title && href.includes('/reference/')) {
        entries.push(this.createEntry(
          title,
          `React API Reference: ${title}`,
          new URL(href, this.config.baseUrl).toString(),
          'api',
          { isIndex: true }
        ));
      }
    });
    
    return entries;
  }
}