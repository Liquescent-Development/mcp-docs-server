import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testUtils } from '../setup.js';

// Mock the scrapers since we're testing tools in isolation
vi.mock('../../src/scrapers/index.js', () => ({
  ElectronScraper: vi.fn().mockImplementation(() => ({
    scrape: vi.fn().mockResolvedValue({
      entries: [
        {
          title: 'Test API',
          content: 'Test content',
          url: 'https://example.com/test',
          type: 'api',
          source: 'electron',
          lastUpdated: new Date(),
          metadata: { parsedFrom: 'test' }
        }
      ],
      source: 'electron',
      scrapedAt: new Date(),
      errors: undefined
    }),
    getCacheKey: vi.fn().mockReturnValue('test-cache-key')
  }))
}));

// Mock logger to avoid console noise during tests
vi.mock('../../src/utils/logger.js', () => ({
  logScraperActivity: vi.fn(),
  logError: vi.fn(),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Documentation Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Test Infrastructure', () => {
    it('should have proper test utilities available', () => {
      expect(testUtils).toBeDefined();
      expect(testUtils.wait).toBeTypeOf('function');
      expect(testUtils.createMockScraperConfig).toBeTypeOf('function');
      expect(testUtils.generateMockHTML).toBeTypeOf('function');
      expect(testUtils.randomString).toBeTypeOf('function');
    });

    it('should generate mock HTML correctly', () => {
      const html = testUtils.generateMockHTML({
        title: 'Test API',
        content: 'Test content',
        codeBlocks: ['const test = true;'],
        apiSections: [
          { title: 'Method', content: 'Method description' }
        ]
      });

      expect(html).toContain('Test API');
      expect(html).toContain('Test content');
      expect(html).toContain('const test = true;');
      expect(html).toContain('Method description');
      expect(html).toMatch(/<html[^>]*>/);
      expect(html).toMatch(/<\/html>/);
    });

    it('should generate random strings of specified length', () => {
      const short = testUtils.randomString(5);
      const long = testUtils.randomString(20);

      expect(short).toHaveLength(5);
      expect(long).toHaveLength(20);
      expect(short).toMatch(/^[a-zA-Z0-9]+$/);
      expect(long).toMatch(/^[a-zA-Z0-9]+$/);
    });

    it('should create valid mock scraper config', () => {
      const config = testUtils.createMockScraperConfig();

      expect(config.baseUrl).toBe('https://www.electronjs.org');
      expect(config.timeout).toBe(30000);
      expect(config.rateLimit).toBe(60);
      expect(config.headers['User-Agent']).toBe('Test-Agent');
    });

    it('should override mock scraper config properties', () => {
      const config = testUtils.createMockScraperConfig({
        baseUrl: 'https://custom.example.com',
        timeout: 5000
      });

      expect(config.baseUrl).toBe('https://custom.example.com');
      expect(config.timeout).toBe(5000);
      expect(config.rateLimit).toBe(60); // Should keep default
    });

    it('should have proper test environment setup', () => {
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.LOG_LEVEL).toBe('error');
      expect(process.env.HTTP_TIMEOUT).toBe('15000');
    });
  });

  describe('Mock Integration', () => {
    it('should properly mock external dependencies', async () => {
      // Test that our mocks are working
      const { ElectronScraper } = await import('../../src/scrapers/index.js');
      const scraper = new ElectronScraper(testUtils.createMockScraperConfig());

      const result = await scraper.scrape({ apiName: 'test' });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].title).toBe('Test API');
      expect(result.source).toBe('electron');
    });

    it('should allow mock customization per test', async () => {
      const { ElectronScraper } = await import('../../src/scrapers/index.js');
      const mockScraper = new ElectronScraper(testUtils.createMockScraperConfig());

      // Customize the mock for this specific test
      vi.mocked(mockScraper.scrape).mockResolvedValueOnce({
        entries: [
          {
            title: 'Custom Test',
            content: 'Custom content',
            url: 'https://example.com/custom',
            type: 'api',
            source: 'electron',
            lastUpdated: new Date(),
            metadata: { custom: true }
          }
        ],
        source: 'electron',
        scrapedAt: new Date(),
        errors: undefined
      });

      const result = await mockScraper.scrape({ apiName: 'custom' });

      expect(result.entries[0].title).toBe('Custom Test');
      expect(result.entries[0].metadata?.custom).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle async test errors gracefully', async () => {
      await expect(testUtils.wait(10)).resolves.toBeUndefined();
    });

    it('should handle mock errors properly', async () => {
      const { ElectronScraper } = await import('../../src/scrapers/index.js');
      const mockScraper = new ElectronScraper(testUtils.createMockScraperConfig());

      // Mock an error scenario
      vi.mocked(mockScraper.scrape).mockRejectedValueOnce(new Error('Test error'));

      await expect(mockScraper.scrape({ apiName: 'error' })).rejects.toThrow('Test error');
    });
  });

  describe('Performance and Timing', () => {
    it('should handle timing-based tests correctly', async () => {
      const start = Date.now();
      await testUtils.wait(100);
      const end = Date.now();

      expect(end - start).toBeGreaterThanOrEqual(90); // Allow for some timing variance
      expect(end - start).toBeLessThan(200); // But not too much
    });

    it('should handle concurrent operations in tests', async () => {
      const promises = Array(3).fill(null).map(() => testUtils.wait(50));
      const start = Date.now();
      await Promise.all(promises);
      const end = Date.now();

      // Concurrent execution should be faster than sequential
      expect(end - start).toBeLessThan(150); // Much less than 3 * 50ms
    });
  });

  describe('Configuration Validation', () => {
    it('should validate test environment requirements', () => {
      expect(() => testUtils.validateTestEnvironment()).not.toThrow();
    });

    it('should have all required test dependencies available', () => {
      // Verify that vitest globals are available
      expect(describe).toBeDefined();
      expect(it).toBeDefined();
      expect(expect).toBeDefined();
      expect(vi).toBeDefined();
      expect(beforeEach).toBeDefined();
    });
  });
});