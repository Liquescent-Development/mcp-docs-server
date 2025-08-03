import { BaseScraper } from './base.js';
import { DocumentationEntry, ScraperConfig, ScraperResult } from '../types.js';
import { generateCacheKey } from '../utils/cache.js';

export class GitHubScraper extends BaseScraper {
  private githubToken?: string;

  constructor(config: ScraperConfig) {
    super(config, 'github');
    this.githubToken = process.env.GITHUB_TOKEN;
    
    // Add auth header if token is available
    if (this.githubToken) {
      this.axiosInstance.defaults.headers.common['Authorization'] = `token ${this.githubToken}`;
    }
    
    this.validateConfig();
  }

  async scrape(params: Record<string, any>): Promise<ScraperResult> {
    const errors: string[] = [];
    const entries: DocumentationEntry[] = [];

    try {
      if (params.repo && params.path) {
        // Scrape specific repository documentation
        const repoEntries = await this.scrapeRepoDocumentation(params.repo, params.path);
        entries.push(...repoEntries);
      } else if (params.apiName) {
        // Scrape GitHub API documentation
        const apiEntries = await this.scrapeApi(params.apiName);
        entries.push(...apiEntries);
      } else if (params.topic) {
        // Search for examples in repositories
        const exampleEntries = await this.searchExamples(params.topic);
        entries.push(...exampleEntries);
      } else {
        // Default: scrape main API documentation
        const indexEntries = await this.scrapeDocumentationIndex();
        entries.push(...indexEntries);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to scrape GitHub docs: ${errorMessage}`);
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

    // Parse GitHub documentation structure
    const apiSections = parser.parseApiDocs({
      selectors: {
        title: 'h1, h2',
        content: '.markdown-body, .content',
        sections: '.rest-operation, .graphql-operation'
      }
    });

    for (const section of apiSections) {
      if (section.title && section.content) {
        entries.push(this.createEntry(
          section.title,
          section.content,
          url,
          'api',
          { parsedFrom: 'github-docs' }
        ));
      }
    }

    // Parse code examples
    const examples = parser.parseCodeExamples();
    for (const example of examples) {
      if (example.code) {
        entries.push(this.createEntry(
          example.description || 'GitHub Example',
          example.code,
          url,
          'example',
          { 
            language: example.language || 'javascript',
            parsedFrom: 'github-docs'
          }
        ));
      }
    }

    return entries;
  }

  getCacheKey(params: Record<string, any>): string {
    return generateCacheKey('github', params);
  }

  private async scrapeApi(apiName: string): Promise<DocumentationEntry[]> {
    const apiUrl = `/rest/reference/${apiName.toLowerCase()}`;
    const html = await this.fetchHtml(apiUrl);
    return this.parse(html, new URL(apiUrl, this.config.baseUrl).toString());
  }

  private async scrapeRepoDocumentation(repo: string, path: string): Promise<DocumentationEntry[]> {
    // Use GitHub API to fetch repository content
    const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
    
    try {
      const response = await this.fetchJson<any>(apiUrl);
      
      if (response.type === 'file' && response.content) {
        // Decode base64 content
        const content = Buffer.from(response.content, 'base64').toString('utf-8');
        
        return [this.createEntry(
          response.name,
          content,
          response.html_url,
          'guide',
          { 
            repo,
            path,
            sha: response.sha
          }
        )];
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch repository documentation: ${errorMessage}`);
    }
    
    return [];
  }

  private async searchExamples(topic: string): Promise<DocumentationEntry[]> {
    // Use GitHub search API to find code examples
    const searchUrl = `https://api.github.com/search/code?q=${encodeURIComponent(topic)}+language:javascript+language:typescript`;
    
    try {
      const response = await this.fetchJson<any>(searchUrl);
      const entries: DocumentationEntry[] = [];
      
      for (const item of response.items.slice(0, 10)) {
        entries.push(this.createEntry(
          item.name,
          `Repository: ${item.repository.full_name}\nPath: ${item.path}`,
          item.html_url,
          'example',
          {
            repository: item.repository.full_name,
            path: item.path,
            score: item.score
          }
        ));
      }
      
      return entries;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to search examples: ${errorMessage}`);
    }
  }

  private async scrapeDocumentationIndex(): Promise<DocumentationEntry[]> {
    const indexUrl = '/rest';
    const html = await this.fetchHtml(indexUrl);
    const parser = this.parseHtml(html, new URL(indexUrl, this.config.baseUrl).toString());
    
    const entries: DocumentationEntry[] = [];
    
    parser.$('.rest-category a, nav a[href*="/rest/"]').each((_, element) => {
      const $el = parser.$(element);
      const href = $el.attr('href');
      const title = $el.text().trim();
      
      if (href && title) {
        entries.push(this.createEntry(
          title,
          `GitHub API Reference: ${title}`,
          new URL(href, this.config.baseUrl).toString(),
          'api',
          { isIndex: true }
        ));
      }
    });
    
    return entries;
  }
}