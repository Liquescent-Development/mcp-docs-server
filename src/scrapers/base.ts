import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { DocumentationEntry, ScraperConfig, ScraperResult, ScraperError } from '../types.js';
import { logScraperActivity, logError } from '../utils/logger.js';
import { DocumentationParser } from '../utils/parser.js';

export abstract class BaseScraper {
  protected config: ScraperConfig;
  protected axiosInstance: AxiosInstance;
  protected source: string;

  constructor(config: ScraperConfig, source: string) {
    this.config = config;
    this.source = source;

    // Create axios instance with default configuration
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'User-Agent': 'MCP-Docs-Server/1.0',
        ...config.headers
      }
    });

    // Add request interceptor for rate limiting
    if (config.rateLimit) {
      let lastRequestTime = 0;
      const minDelay = 60000 / config.rateLimit; // Convert to ms between requests

      this.axiosInstance.interceptors.request.use(async (config) => {
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        
        if (timeSinceLastRequest < minDelay) {
          const delay = minDelay - timeSinceLastRequest;
          logScraperActivity(this.source, 'rate limiting', { delay });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        lastRequestTime = Date.now();
        return config;
      });
    }
  }

  /**
   * Abstract method to scrape documentation
   */
  abstract scrape(params: Record<string, any>): Promise<ScraperResult>;

  /**
   * Abstract method to parse scraped content
   */
  abstract parse(html: string, url: string): DocumentationEntry[];

  /**
   * Generate a cache key for the given parameters
   */
  abstract getCacheKey(params: Record<string, any>): string;

  /**
   * Fetch HTML content from a URL
   */
  protected async fetchHtml(url: string, config?: AxiosRequestConfig): Promise<string> {
    // Validate URL for security
    this.validateUrl(url);
    
    try {
      logScraperActivity(this.source, 'fetching', { url });
      
      const response = await this.axiosInstance.get(url, {
        ...config,
        responseType: 'text'
      });

      logScraperActivity(this.source, 'fetched successfully', { 
        url, 
        statusCode: response.status,
        contentLength: response.data.length 
      });

      return response.data;
    } catch (error) {
      const scraperError = new ScraperError(
        `Failed to fetch ${url}`,
        this.source,
        error as Error
      );
      
      logError(scraperError, { url, source: this.source });
      throw scraperError;
    }
  }

  /**
   * Fetch JSON data from a URL
   */
  protected async fetchJson<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    // Validate URL for security
    this.validateUrl(url);
    
    try {
      logScraperActivity(this.source, 'fetching JSON', { url });
      
      const response = await this.axiosInstance.get<T>(url, {
        ...config,
        responseType: 'json'
      });

      logScraperActivity(this.source, 'fetched JSON successfully', { 
        url, 
        statusCode: response.status 
      });

      return response.data;
    } catch (error) {
      const scraperError = new ScraperError(
        `Failed to fetch JSON from ${url}`,
        this.source,
        error as Error
      );
      
      logError(scraperError, { url, source: this.source });
      throw scraperError;
    }
  }

  /**
   * Parse HTML using the DocumentationParser
   */
  protected parseHtml(html: string, url: string): DocumentationParser {
    return new DocumentationParser(html, url);
  }

  /**
   * Create a standardized documentation entry
   */
  protected createEntry(
    title: string,
    content: string,
    url: string,
    type: DocumentationEntry['type'],
    metadata?: Record<string, any>
  ): DocumentationEntry {
    return {
      title,
      content,
      url,
      type,
      source: this.source as DocumentationEntry['source'],
      lastUpdated: new Date(),
      metadata
    };
  }

  /**
   * Batch process multiple URLs
   */
  protected async batchFetch(urls: string[], concurrency: number = 3): Promise<string[]> {
    const results: string[] = [];
    const errors: Error[] = [];

    // Process URLs in batches
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchPromises = batch.map(url => 
        this.fetchHtml(url).catch(error => {
          errors.push(error);
          return null;
        })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r): r is string => r !== null));
    }

    if (errors.length > 0) {
      logScraperActivity(this.source, 'batch fetch completed with errors', {
        successCount: results.length,
        errorCount: errors.length
      });
    }

    return results;
  }

  /**
   * Validate scraper configuration
   */
  protected validateConfig(): void {
    if (!this.config.baseUrl) {
      throw new Error(`Base URL is required for ${this.source} scraper`);
    }

    try {
      new URL(this.config.baseUrl);
    } catch {
      throw new Error(`Invalid base URL for ${this.source} scraper: ${this.config.baseUrl}`);
    }
  }

  /**
   * Validate URL for security - prevent SSRF and other attacks
   */
  protected validateUrl(url: string): void {
    try {
      const parsedUrl = new URL(url, this.config.baseUrl);
      
      // Only allow HTTP and HTTPS protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error(`Invalid protocol: ${parsedUrl.protocol}`);
      }
      
      // Prevent access to private/internal networks
      const hostname = parsedUrl.hostname.toLowerCase();
      
      // Block localhost and private IP ranges
      if (hostname === 'localhost' || 
          hostname === '127.0.0.1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
        throw new Error(`Access to private network not allowed: ${hostname}`);
      }
      
      // Block common meta-addresses
      if (hostname === '0.0.0.0' || hostname === '::1' || hostname === '[::]') {
        throw new Error(`Access to meta-address not allowed: ${hostname}`);
      }
      
    } catch (error) {
      const scraperError = new ScraperError(
        `Invalid or unsafe URL: ${url}`,
        this.source,
        error as Error
      );
      logError(scraperError, { url, source: this.source });
      throw scraperError;
    }
  }
}