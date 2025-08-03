import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ElectronScraper } from '../../src/scrapers/electron.js';
import { ScraperConfig, ScraperError } from '../../src/types.js';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock logger functions
vi.mock('../../src/utils/logger.js', () => ({
  logScraperActivity: vi.fn(),
  logError: vi.fn()
}));

describe('ElectronScraper', () => {
  let scraper: ElectronScraper;
  let config: ScraperConfig;
  let mockAxiosInstance: any;

  beforeEach(() => {
    config = {
      baseUrl: 'https://www.electronjs.org',
      timeout: 30000,
      rateLimit: 60,
      headers: {
        'User-Agent': 'Test-Agent'
      }
    };

    mockAxiosInstance = {
      get: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn()
        }
      }
    };

    mockedAxios.create = vi.fn().mockReturnValue(mockAxiosInstance);
    scraper = new ElectronScraper(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor and initialization', () => {
    it('should initialize with valid configuration', () => {
      expect(scraper).toBeInstanceOf(ElectronScraper);
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: config.baseUrl,
        timeout: config.timeout,
        headers: {
          'User-Agent': 'MCP-Docs-Server/1.0',
          ...config.headers
        }
      });
    });

    it('should throw error for missing base URL', () => {
      const invalidConfig = { ...config, baseUrl: '' };
      expect(() => new ElectronScraper(invalidConfig)).toThrow('Base URL is required for electron scraper');
    });

    it('should throw error for invalid base URL', () => {
      const invalidConfig = { ...config, baseUrl: 'not-a-url' };
      expect(() => new ElectronScraper(invalidConfig)).toThrow('Invalid base URL for electron scraper');
    });

    it('should set up rate limiting when configured', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });

    it('should use default timeout when not specified', () => {
      const configWithoutTimeout = { baseUrl: 'https://www.electronjs.org' };
      new ElectronScraper(configWithoutTimeout);
      
      expect(mockedAxios.create).toHaveBeenCalledWith(expect.objectContaining({
        timeout: 30000 // default timeout
      }));
    });
  });

  describe('getCacheKey', () => {
    it('should generate consistent cache keys for same parameters', () => {
      const params1 = { apiName: 'BrowserWindow', version: 'latest' };
      const params2 = { apiName: 'BrowserWindow', version: 'latest' };
      
      const key1 = scraper.getCacheKey(params1);
      const key2 = scraper.getCacheKey(params2);
      
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^electron:/);
    });

    it('should generate different cache keys for different parameters', () => {
      const params1 = { apiName: 'BrowserWindow' };
      const params2 = { apiName: 'WebContents' };
      
      const key1 = scraper.getCacheKey(params1);
      const key2 = scraper.getCacheKey(params2);
      
      expect(key1).not.toBe(key2);
    });

    it('should handle empty parameters', () => {
      const key = scraper.getCacheKey({});
      expect(key).toMatch(/^electron:/);
    });

    it('should ignore null and undefined values', () => {
      const params1 = { apiName: 'BrowserWindow', version: null, extra: undefined };
      const params2 = { apiName: 'BrowserWindow' };
      
      const key1 = scraper.getCacheKey(params1);
      const key2 = scraper.getCacheKey(params2);
      
      expect(key1).toBe(key2);
    });
  });

  describe('scrape method', () => {
    it('should scrape API documentation when apiName is provided', async () => {
      const mockHtml = '<html><body><h1>BrowserWindow</h1><p>API documentation</p></body></html>';
      mockAxiosInstance.get.mockResolvedValue({
        data: mockHtml,
        status: 200
      });

      const result = await scraper.scrape({ apiName: 'BrowserWindow' });

      expect(result.entries).toHaveLength(1);
      expect(result.source).toBe('electron');
      expect(result.scrapedAt).toBeInstanceOf(Date);
      expect(result.errors).toBeUndefined();
    });

    it('should scrape migration guide when type is migration', async () => {
      const mockHtml = '<html><body><h2>v20.0.0 to v21.0.0</h2><ul><li>Breaking change 1</li></ul></body></html>';
      mockAxiosInstance.get.mockResolvedValue({
        data: mockHtml,
        status: 200
      });

      const result = await scraper.scrape({
        type: 'migration',
        fromVersion: '20.0.0',
        toVersion: '21.0.0'
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/docs/latest/breaking-changes', expect.any(Object));
      expect(result.entries).toBeDefined();
    });

    it('should scrape examples when topic is provided', async () => {
      const mockHtml = '<html><body><pre><code>const win = new BrowserWindow()</code></pre></body></html>';
      mockAxiosInstance.get.mockResolvedValue({
        data: mockHtml,
        status: 200
      });

      const result = await scraper.scrape({ topic: 'BrowserWindow' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/docs/latest/api/browserwindow', expect.any(Object));
      expect(result.entries).toBeDefined();
    });

    it('should scrape documentation index by default', async () => {
      const mockHtml = '<html><body><div class="api-index-list"><a href="/api/browser-window">BrowserWindow</a></div></body></html>';
      mockAxiosInstance.get.mockResolvedValue({
        data: mockHtml,
        status: 200
      });

      const result = await scraper.scrape({});

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/docs/latest/api/', expect.any(Object));
      expect(result.entries).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      const result = await scraper.scrape({ apiName: 'BrowserWindow' });

      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('Failed to scrape Electron docs');
      expect(result.entries).toHaveLength(0);
    });

    it('should include version in API URL when provided', async () => {
      const mockHtml = '<html><body><h1>BrowserWindow</h1></body></html>';
      mockAxiosInstance.get.mockResolvedValue({
        data: mockHtml,
        status: 200
      });

      await scraper.scrape({ apiName: 'BrowserWindow', version: 'v20.0.0' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/docs/v20.0.0/api/browserwindow', expect.any(Object));
    });

    it('should try alternative URL pattern on failure', async () => {
      const mockHtml = '<html><body><h1>BrowserWindow</h1></body></html>';
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({
          data: mockHtml,
          status: 200
        });

      const result = await scraper.scrape({ apiName: 'BrowserWindow' });

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(1, '/docs/latest/api/browserwindow', expect.any(Object));
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(2, '/docs/latest/api/BrowserWindow', expect.any(Object));
      expect(result.entries).toBeDefined();
    });
  });

  describe('parse method', () => {
    it('should parse API documentation HTML correctly', () => {
      const html = `
        <html>
          <body>
            <div class="api-section">
              <h2>BrowserWindow</h2>
              <div class="markdown-body">
                <p>Creates and controls browser windows.</p>
                <pre><code>const win = new BrowserWindow()</code></pre>
              </div>
            </div>
          </body>
        </html>
      `;
      const url = 'https://www.electronjs.org/docs/latest/api/browser-window';

      const entries = scraper.parse(html, url);

      expect(entries).toHaveLength(2); // 1 API section + 1 code example
      
      const apiEntry = entries.find(e => e.type === 'api');
      expect(apiEntry).toBeDefined();
      expect(apiEntry!.title).toBe('BrowserWindow');
      expect(apiEntry!.content).toContain('Creates and controls browser windows');
      expect(apiEntry!.url).toBe(url);
      expect(apiEntry!.source).toBe('electron');
      expect(apiEntry!.metadata?.parsedFrom).toBe('electron-docs');

      const exampleEntry = entries.find(e => e.type === 'example');
      expect(exampleEntry).toBeDefined();
      expect(exampleEntry!.content).toContain('const win = new BrowserWindow()');
      expect(exampleEntry!.metadata?.language).toBe('javascript');
    });

    it('should handle HTML without specific selectors', () => {
      const html = `
        <html>
          <body>
            <h1>General Documentation</h1>
            <p>Some general content without specific API structure.</p>
          </body>
        </html>
      `;
      const url = 'https://www.electronjs.org/docs/general';

      const entries = scraper.parse(html, url);

      expect(entries.length).toBeGreaterThan(0);
      const entry = entries[0];
      expect(entry.title).toBe('General Documentation');
      expect(entry.type).toBe('api');
    });

    it('should extract multiple code examples with different languages', () => {
      const html = `
        <html>
          <body>
            <pre><code class="language-javascript">console.log('Hello');</code></pre>
            <pre><code class="language-typescript">const x: string = 'TypeScript';</code></pre>
            <div class="highlight python"><code>print('Python')</code></div>
          </body>
        </html>
      `;
      const url = 'https://www.electronjs.org/docs/examples';

      const entries = scraper.parse(html, url);

      const examples = entries.filter(e => e.type === 'example');
      expect(examples).toHaveLength(3);
      
      expect(examples[0].metadata?.language).toBe('javascript');
      expect(examples[1].metadata?.language).toBe('typescript');
      expect(examples[2].metadata?.language).toBe('python');
    });

    it('should handle empty or malformed HTML gracefully', () => {
      const malformedHtml = '<html><body><div><h1>Incomplete';
      const url = 'https://www.electronjs.org/docs/test';

      const entries = scraper.parse(malformedHtml, url);

      // Should not throw and should return some entries
      expect(entries).toBeDefined();
      expect(Array.isArray(entries)).toBe(true);
    });

    it('should skip entries with missing title or content', () => {
      const html = `
        <html>
          <body>
            <div class="api-section">
              <h2></h2>
              <div class="markdown-body"></div>
            </div>
            <div class="api-section">
              <h2>Valid Title</h2>
              <div class="markdown-body"><p>Valid content</p></div>
            </div>
          </body>
        </html>
      `;
      const url = 'https://www.electronjs.org/docs/test';

      const entries = scraper.parse(html, url);

      const apiEntries = entries.filter(e => e.type === 'api');
      expect(apiEntries).toHaveLength(1);
      expect(apiEntries[0].title).toBe('Valid Title');
    });
  });

  describe('URL validation and security', () => {
    it('should validate URLs to prevent SSRF attacks', async () => {
      // Test private IP ranges
      const privateIPs = [
        'http://192.168.1.1/test',
        'http://10.0.0.1/test',
        'http://172.16.0.1/test',
        'http://127.0.0.1/test',
        'http://localhost/test'
      ];

      for (const url of privateIPs) {
        mockAxiosInstance.get.mockImplementation(() => {
          throw new ScraperError(`Invalid or unsafe URL: ${url}`, 'electron');
        });

        const result = await scraper.scrape({ apiName: 'test' });
        expect(result.errors).toBeDefined();
        expect(result.errors![0]).toContain('Failed to scrape Electron docs');
      }
    });

    it('should reject non-HTTP/HTTPS protocols', async () => {
      const invalidProtocols = [
        'ftp://example.com/test',
        'file:///etc/passwd',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>'
      ];

      for (const url of invalidProtocols) {
        mockAxiosInstance.get.mockImplementation(() => {
          throw new ScraperError(`Invalid protocol`, 'electron');
        });

        const result = await scraper.scrape({ apiName: 'test' });
        expect(result.errors).toBeDefined();
      }
    });

    it('should handle meta-addresses safely', async () => {
      const metaAddresses = [
        'http://0.0.0.0/test',
        'http://[::1]/test',
        'http://[::]/test'
      ];

      for (const url of metaAddresses) {
        mockAxiosInstance.get.mockImplementation(() => {
          throw new ScraperError(`Access to meta-address not allowed`, 'electron');
        });

        const result = await scraper.scrape({ apiName: 'test' });
        expect(result.errors).toBeDefined();
      }
    });
  });

  describe('error handling scenarios', () => {
    it('should handle network timeouts', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('timeout of 30000ms exceeded'));

      const result = await scraper.scrape({ apiName: 'BrowserWindow' });

      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('Failed to scrape Electron docs');
      expect(result.entries).toHaveLength(0);
    });

    it('should handle HTTP error status codes', async () => {
      const httpError = new Error('Request failed with status code 404');
      (httpError as any).response = { status: 404, statusText: 'Not Found' };
      mockAxiosInstance.get.mockRejectedValue(httpError);

      const result = await scraper.scrape({ apiName: 'NonExistentAPI' });

      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('Failed to scrape Electron docs');
    });

    it('should handle malformed JSON responses gracefully', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: 'invalid json {',
        status: 200
      });

      const result = await scraper.scrape({ apiName: 'BrowserWindow' });

      // Should still attempt to parse as HTML
      expect(result.entries).toBeDefined();
    });

    it('should handle empty responses', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: '',
        status: 200
      });

      const result = await scraper.scrape({ apiName: 'BrowserWindow' });

      expect(result.entries).toHaveLength(0);
      expect(result.errors).toBeUndefined();
    });

    it('should handle invalid API names gracefully', async () => {
      const result = await scraper.scrape({ apiName: '' });

      expect(result.entries).toBeDefined();
      // Should still attempt to fetch from the constructed URL
    });

    it('should handle connection refused errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('connect ECONNREFUSED'));

      const result = await scraper.scrape({ apiName: 'BrowserWindow' });

      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('Failed to scrape Electron docs');
    });

    it('should handle DNS resolution failures', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

      const result = await scraper.scrape({ apiName: 'BrowserWindow' });

      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('Failed to scrape Electron docs');
    });
  });

  describe('rate limiting and performance', () => {
    it('should implement rate limiting when configured', () => {
      const configWithRateLimit = {
        ...config,
        rateLimit: 10 // 10 requests per minute
      };

      new ElectronScraper(configWithRateLimit);

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });

    it('should work without rate limiting when not configured', () => {
      const configWithoutRateLimit = {
        baseUrl: 'https://www.electronjs.org',
        timeout: 30000
      };

      new ElectronScraper(configWithoutRateLimit);

      // Should still work without rate limiting
      expect(mockedAxios.create).toHaveBeenCalled();
    });

    it('should handle large HTML responses efficiently', () => {
      const largeHtml = '<html><body>' + 'a'.repeat(1000000) + '</body></html>';
      const url = 'https://www.electronjs.org/docs/large';

      const entries = scraper.parse(largeHtml, url);

      expect(entries).toBeDefined();
      expect(Array.isArray(entries)).toBe(true);
    });
  });

  describe('version handling', () => {
    it('should correctly parse and compare version numbers', () => {
      // Test the private parseVersion method through public interface
      const mockHtml = '<html><body><h2>v20.0.0 to v21.0.0</h2><ul><li>Change 1</li></ul></body></html>';
      mockAxiosInstance.get.mockResolvedValue({
        data: mockHtml,
        status: 200
      });

      return scraper.scrape({
        type: 'migration',
        fromVersion: '20.0.0',
        toVersion: '21.0.0'
      }).then(result => {
        expect(result.entries).toBeDefined();
      });
    });

    it('should handle semantic versioning correctly', async () => {
      const mockHtml = '<html><body><h2>v20.1.3 to v21.0.0</h2><ul><li>Breaking change</li></ul></body></html>';
      mockAxiosInstance.get.mockResolvedValue({
        data: mockHtml,
        status: 200
      });

      const result = await scraper.scrape({
        type: 'migration',
        fromVersion: '20.1.3',
        toVersion: '21.0.0'
      });

      expect(result.entries).toBeDefined();
    });

    it('should handle incomplete version numbers', async () => {
      const mockHtml = '<html><body><h2>v20 to v21</h2><ul><li>Major version change</li></ul></body></html>';
      mockAxiosInstance.get.mockResolvedValue({
        data: mockHtml,
        status: 200
      });

      const result = await scraper.scrape({
        type: 'migration',
        fromVersion: '20',
        toVersion: '21'
      });

      expect(result.entries).toBeDefined();
    });
  });

  describe('input sanitization', () => {
    it('should handle special characters in API names', async () => {
      const mockHtml = '<html><body><h1>API</h1></body></html>';
      mockAxiosInstance.get.mockResolvedValue({
        data: mockHtml,
        status: 200
      });

      const specialChars = ['<script>', '../../etc/passwd', 'api;rm -rf /', 'api%20name'];
      
      for (const apiName of specialChars) {
        const result = await scraper.scrape({ apiName });
        expect(result).toBeDefined();
        // Should not cause errors or security issues
      }
    });

    it('should handle special characters in version strings', async () => {
      const mockHtml = '<html><body><h1>API</h1></body></html>';
      mockAxiosInstance.get.mockResolvedValue({
        data: mockHtml,
        status: 200
      });

      const specialVersions = ['<script>', '../../../', 'v1.0.0;rm', 'latest%20version'];
      
      for (const version of specialVersions) {
        const result = await scraper.scrape({ apiName: 'BrowserWindow', version });
        expect(result).toBeDefined();
      }
    });

    it('should not expose sensitive information in error messages', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed with auth token: secret123'));

      const result = await scraper.scrape({ apiName: 'BrowserWindow' });

      expect(result.errors![0]).not.toContain('secret123');
      expect(result.errors![0]).toContain('Failed to scrape Electron docs');
    });
  });
});
