import { BaseScraper } from './base.js';
import { DocumentationEntry, ScraperConfig, ScraperResult } from '../types.js';
import { generateCacheKey } from '../utils/cache.js';

export class NodeScraper extends BaseScraper {
  constructor(config: ScraperConfig) {
    super(config, 'node');
    this.validateConfig();
  }

  async scrape(params: Record<string, any>): Promise<ScraperResult> {
    const errors: string[] = [];
    const entries: DocumentationEntry[] = [];

    try {
      if (params.apiName) {
        const apiEntries = await this.scrapeApi(params.apiName, params.version);
        entries.push(...apiEntries);
      } else if (params.topic) {
        const exampleEntries = await this.scrapeExamples(params.topic);
        entries.push(...exampleEntries);
      } else {
        const indexEntries = await this.scrapeDocumentationIndex();
        entries.push(...indexEntries);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to scrape Node.js docs: ${errorMessage}`);
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

    // Parse Node.js documentation structure
    const apiSections = parser.parseApiDocs({
      selectors: {
        title: 'h1, h2, h3',
        content: '#apicontent',
        sections: '.api_metadata, .api-section'
      }
    });

    for (const section of apiSections) {
      if (section.title && section.content) {
        entries.push(this.createEntry(
          section.title,
          section.content,
          url,
          'api',
          { parsedFrom: 'node-docs' }
        ));
      }
    }

    // Parse code examples
    const examples = parser.parseCodeExamples();
    for (const example of examples) {
      if (example.code) {
        entries.push(this.createEntry(
          example.description || 'Node.js Example',
          example.code,
          url,
          'example',
          { 
            language: example.language || 'javascript',
            parsedFrom: 'node-docs'
          }
        ));
      }
    }

    return entries;
  }

  getCacheKey(params: Record<string, any>): string {
    return generateCacheKey('node', params);
  }

  private async scrapeApi(apiName: string, version?: string): Promise<DocumentationEntry[]> {
    const versionPath = version ? `docs/${version}` : 'api';
    const apiUrl = `/${versionPath}/${apiName.toLowerCase()}.html`;
    
    try {
      const html = await this.fetchHtml(apiUrl);
      return this.parse(html, new URL(apiUrl, this.config.baseUrl).toString());
    } catch (error) {
      // Try without .html extension
      const alternativeUrl = `/${versionPath}/${apiName.toLowerCase()}`;
      const html = await this.fetchHtml(alternativeUrl);
      return this.parse(html, new URL(alternativeUrl, this.config.baseUrl).toString());
    }
  }

  private async scrapeExamples(topic: string): Promise<DocumentationEntry[]> {
    const searchUrl = `/api/${topic.toLowerCase()}.html`;
    const html = await this.fetchHtml(searchUrl);
    const entries = this.parse(html, new URL(searchUrl, this.config.baseUrl).toString());
    
    return entries.filter(entry => entry.type === 'example');
  }

  private async scrapeDocumentationIndex(): Promise<DocumentationEntry[]> {
    const indexUrl = '/api/';
    const html = await this.fetchHtml(indexUrl);
    const parser = this.parseHtml(html, new URL(indexUrl, this.config.baseUrl).toString());
    
    const entries: DocumentationEntry[] = [];
    
    parser.$('#apicontent a, .nav-link').each((_, element) => {
      const $el = parser.$(element);
      const href = $el.attr('href');
      const title = $el.text().trim();
      
      if (href && title && href.endsWith('.html')) {
        entries.push(this.createEntry(
          title,
          `Node.js API Reference: ${title}`,
          new URL(href, this.config.baseUrl).toString(),
          'api',
          { isIndex: true }
        ));
      }
    });
    
    return entries;
  }
}