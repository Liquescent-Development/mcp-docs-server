import * as cheerio from 'cheerio';
import { DocumentationEntry } from '../types.js';

export interface ParseOptions {
  selectors?: {
    title?: string;
    content?: string;
    code?: string;
    sections?: string;
  };
  baseUrl?: string;
  transformers?: {
    title?: (text: string) => string;
    content?: (text: string) => string;
  };
}

export class DocumentationParser {
  public $: cheerio.CheerioAPI;
  private baseUrl: string;

  constructor(html: string, baseUrl: string = '') {
    this.$ = cheerio.load(html);
    this.baseUrl = baseUrl;
  }

  /**
   * Extract API documentation entries from HTML
   */
  parseApiDocs(options: ParseOptions = {}): Partial<DocumentationEntry>[] {
    const selectors = {
      title: 'h1, h2, h3',
      content: 'p, pre, code',
      sections: '.api-section, .method, .function',
      ...options.selectors
    };

    const entries: Partial<DocumentationEntry>[] = [];
    const sections = this.$(selectors.sections);

    if (sections.length === 0) {
      // Fallback to parsing the entire document
      const title = this.$(selectors.title).first().text().trim();
      const content = this.extractContent(this.$('body'));
      
      if (title && content) {
        entries.push({
          title: options.transformers?.title ? options.transformers.title(title) : title,
          content: options.transformers?.content ? options.transformers.content(content) : content,
          type: 'api'
        });
      }
    } else {
      sections.each((_, element) => {
        const section = this.$(element);
        const title = section.find(selectors.title).first().text().trim();
        const content = this.extractContent(section);
        
        if (title && content) {
          entries.push({
            title: options.transformers?.title ? options.transformers.title(title) : title,
            content: options.transformers?.content ? options.transformers.content(content) : content,
            type: 'api'
          });
        }
      });
    }

    return entries;
  }

  /**
   * Extract code examples from HTML
   */
  parseCodeExamples(): Array<{ code: string; language?: string; description?: string }> {
    const examples: Array<{ code: string; language?: string; description?: string }> = [];
    
    // Look for code blocks
    this.$('pre code, .highlight, .code-example').each((_, element) => {
      const codeElement = this.$(element);
      const code = codeElement.text().trim();
      
      if (code) {
        // Try to detect language from class names
        const classes = codeElement.attr('class') || '';
        const languageMatch = classes.match(/language-(\w+)|lang-(\w+)|(\w+)-highlight/);
        const language = languageMatch ? (languageMatch[1] || languageMatch[2] || languageMatch[3]) : undefined;
        
        // Look for description in preceding paragraph or heading
        const prevElement = codeElement.parent().prev();
        const description = prevElement.is('p, h3, h4') ? prevElement.text().trim() : undefined;
        
        examples.push({ code, language, description });
      }
    });

    return examples;
  }

  /**
   * Extract migration guide sections
   */
  parseMigrationGuide(): Array<{ fromVersion: string; toVersion: string; changes: string[] }> {
    const guides: Array<{ fromVersion: string; toVersion: string; changes: string[] }> = [];
    
    // Look for version headers
    const versionPattern = /(?:from\s+)?v?(\d+\.\d+(?:\.\d+)?)\s+(?:to\s+)?v?(\d+\.\d+(?:\.\d+)?)/i;
    
    this.$('h2, h3').each((_, element) => {
      const heading = this.$(element);
      const text = heading.text();
      const match = text.match(versionPattern);
      
      if (match) {
        const fromVersion = match[1];
        const toVersion = match[2];
        const changes: string[] = [];
        
        // Collect changes until next heading
        let nextElement = heading.next();
        while (nextElement.length && !nextElement.is('h1, h2, h3')) {
          if (nextElement.is('ul, ol')) {
            nextElement.find('li').each((_, li) => {
              changes.push(this.$(li).text().trim());
            });
          } else if (nextElement.is('p')) {
            const text = nextElement.text().trim();
            if (text) changes.push(text);
          }
          nextElement = nextElement.next();
        }
        
        if (changes.length > 0) {
          guides.push({ fromVersion, toVersion, changes });
        }
      }
    });
    
    return guides;
  }

  /**
   * Extract structured content from an element
   */
  private extractContent(element: cheerio.Cheerio<any>): string {
    // Remove script and style tags
    element.find('script, style').remove();
    
    // Extract text content while preserving code blocks
    const contentParts: string[] = [];
    
    element.find('p, pre, code, ul, ol, blockquote').each((_: number, el: any) => {
      const $el = this.$(el);
      
      if ($el.is('pre, code')) {
        contentParts.push(`\`\`\`\n${$el.text().trim()}\n\`\`\``);
      } else if ($el.is('ul, ol')) {
        $el.find('li').each((_, li) => {
          contentParts.push(`" ${this.$(li).text().trim()}`);
        });
      } else {
        const text = $el.text().trim();
        if (text) contentParts.push(text);
      }
    });
    
    return contentParts.join('\n\n');
  }

  /**
   * Convert relative URLs to absolute URLs
   */
  resolveUrls(): void {
    if (!this.baseUrl) return;
    
    this.$('a[href]').each((_, element) => {
      const $el = this.$(element);
      const href = $el.attr('href');
      if (href && !href.startsWith('http') && !href.startsWith('//')) {
        $el.attr('href', new URL(href, this.baseUrl).toString());
      }
    });
    
    this.$('img[src]').each((_, element) => {
      const $el = this.$(element);
      const src = $el.attr('src');
      if (src && !src.startsWith('http') && !src.startsWith('//')) {
        $el.attr('src', new URL(src, this.baseUrl).toString());
      }
    });
  }

  /**
   * Get the cleaned HTML
   */
  getHtml(): string {
    return this.$.html();
  }

  /**
   * Get plain text content
   */
  getText(): string {
    return this.$('body').text().trim();
  }
}