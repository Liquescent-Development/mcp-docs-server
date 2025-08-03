import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { ElectronScraper } from '../../src/scrapers/electron.js';
import { ScraperConfig } from '../../src/types.js';

// Integration tests that connect to real Electron documentation
// These tests verify that the scraper works with the actual Electron docs structure
describe('ElectronScraper Integration Tests', () => {
  let scraper: ElectronScraper;
  let config: ScraperConfig;

  beforeAll(() => {
    config = {
      baseUrl: 'https://www.electronjs.org',
      timeout: 30000,
      rateLimit: 30, // Reduced rate limit for integration tests
      headers: {
        'User-Agent': 'MCP-Docs-Server-Test/1.0'
      }
    };
    scraper = new ElectronScraper(config);
  });

  // Add delay between tests to respect rate limits
  afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('Real Electron API Documentation', () => {
    it('should successfully scrape BrowserWindow API documentation', async () => {
      const result = await scraper.scrape({ 
        apiName: 'BrowserWindow',
        version: 'latest'
      });

      expect(result.errors).toBeUndefined();
      expect(result.entries).toHaveLength.greaterThan(0);
      expect(result.source).toBe('electron');
      expect(result.scrapedAt).toBeInstanceOf(Date);

      // Verify we got actual API content
      const apiEntries = result.entries.filter(e => e.type === 'api');
      expect(apiEntries.length).toBeGreaterThan(0);

      const mainEntry = apiEntries[0];
      expect(mainEntry.title).toMatch(/BrowserWindow/i);
      expect(mainEntry.content).toContain('BrowserWindow');
      expect(mainEntry.url).toMatch(/electronjs\.org.*api.*browser.*window/i);
      expect(mainEntry.source).toBe('electron');
      expect(mainEntry.lastUpdated).toBeInstanceOf(Date);
      expect(mainEntry.metadata?.parsedFrom).toBe('electron-docs');
    }, 20000);

    it('should successfully scrape WebContents API documentation', async () => {
      const result = await scraper.scrape({ 
        apiName: 'WebContents'
      });

      expect(result.errors).toBeUndefined();
      expect(result.entries).toHaveLength.greaterThan(0);

      const apiEntries = result.entries.filter(e => e.type === 'api');
      expect(apiEntries.length).toBeGreaterThan(0);

      const mainEntry = apiEntries[0];
      expect(mainEntry.title).toMatch(/WebContents/i);
      expect(mainEntry.content).toContain('WebContents');
      expect(mainEntry.url).toMatch(/electronjs\.org.*api.*web.*contents/i);
    }, 20000);

    it('should successfully scrape Menu API documentation', async () => {
      const result = await scraper.scrape({ 
        apiName: 'Menu'
      });

      expect(result.errors).toBeUndefined();
      expect(result.entries).toHaveLength.greaterThan(0);

      const apiEntries = result.entries.filter(e => e.type === 'api');
      expect(apiEntries.length).toBeGreaterThan(0);

      const mainEntry = apiEntries[0];
      expect(mainEntry.title).toMatch(/Menu/i);
      expect(mainEntry.url).toMatch(/electronjs\.org.*api.*menu/i);
    }, 20000);

    it('should extract code examples from API documentation', async () => {
      const result = await scraper.scrape({ 
        apiName: 'BrowserWindow'
      });

      expect(result.errors).toBeUndefined();
      
      const exampleEntries = result.entries.filter(e => e.type === 'example');
      expect(exampleEntries.length).toBeGreaterThan(0);

      // Check that examples contain actual code
      const codeExample = exampleEntries[0];
      expect(codeExample.content).toMatch(/(const|let|var|function|new\s+BrowserWindow)/);
      expect(codeExample.metadata?.language).toBeDefined();
      expect(codeExample.source).toBe('electron');
    }, 20000);

    it('should handle case-insensitive API names', async () => {
      const result = await scraper.scrape({ 
        apiName: 'browserwindow' // lowercase
      });

      expect(result.errors).toBeUndefined();
      expect(result.entries).toHaveLength.greaterThan(0);

      const apiEntries = result.entries.filter(e => e.type === 'api');
      expect(apiEntries.length).toBeGreaterThan(0);
    }, 20000);

    it('should fall back to alternative URL patterns for non-standard API names', async () => {
      const result = await scraper.scrape({ 
        apiName: 'process' // This might use different URL structure
      });

      // Should either succeed or fail gracefully
      if (result.errors) {
        expect(result.errors).toHaveLength.greaterThan(0);
        expect(result.entries).toHaveLength(0);
      } else {
        expect(result.entries).toHaveLength.greaterThan(0);
      }
    }, 20000);
  });

  describe('Migration Guide Scraping', () => {
    it('should successfully scrape breaking changes documentation', async () => {
      const result = await scraper.scrape({
        type: 'migration',
        fromVersion: '20.0.0',
        toVersion: '21.0.0'
      });

      expect(result.errors).toBeUndefined();
      expect(result.entries).toBeDefined();

      // Migration guides might have specific content structure
      if (result.entries.length > 0) {
        const migrationEntry = result.entries.find(e => e.type === 'migration');
        if (migrationEntry) {
          expect(migrationEntry.title).toMatch(/Migration|Breaking|Change/i);
          expect(migrationEntry.content).toContain('20');
          expect(migrationEntry.content).toContain('21');
          expect(migrationEntry.metadata?.fromVersion).toBe('20.0.0');
          expect(migrationEntry.metadata?.toVersion).toBe('21.0.0');
        }
      }
    }, 20000);

    it('should handle version ranges in migration documentation', async () => {
      const result = await scraper.scrape({
        type: 'migration',
        fromVersion: '19.0.0',
        toVersion: '22.0.0'
      });

      expect(result.errors).toBeUndefined();
      expect(result.entries).toBeDefined();
      // Should include multiple version migrations if available
    }, 20000);
  });

  describe('Example Scraping', () => {
    it('should successfully scrape examples for popular topics', async () => {
      const topics = ['BrowserWindow', 'WebContents', 'dialog'];

      for (const topic of topics) {
        const result = await scraper.scrape({ topic });
        
        expect(result.errors).toBeUndefined();
        
        const examples = result.entries.filter(e => e.type === 'example');
        // Examples might not always be available, but if they are, they should be valid
        if (examples.length > 0) {
          const example = examples[0];
          expect(example.content).toMatch(/(const|let|var|function|require|import)/);
          expect(example.metadata?.language).toBeDefined();
        }

        // Add delay between topic requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }, 30000);

    it('should filter examples correctly', async () => {
      const result = await scraper.scrape({ topic: 'BrowserWindow' });
      
      expect(result.errors).toBeUndefined();
      
      // All returned entries should either be examples or the results should be filtered correctly
      const examples = result.entries.filter(e => e.type === 'example');
      const nonExamples = result.entries.filter(e => e.type !== 'example');
      
      // If non-examples exist, they should still be relevant to the topic
      for (const entry of nonExamples) {
        expect(entry.source).toBe('electron');
      }
    }, 20000);
  });

  describe('Documentation Index Scraping', () => {
    it('should successfully scrape the main API index', async () => {
      const result = await scraper.scrape({});

      expect(result.errors).toBeUndefined();
      expect(result.entries).toHaveLength.greaterThan(0);

      // Should contain index entries for various APIs
      const indexEntries = result.entries.filter(e => e.metadata?.isIndex);
      expect(indexEntries.length).toBeGreaterThan(0);

      // Check that index entries have proper URLs
      for (const entry of indexEntries) {
        expect(entry.url).toMatch(/electronjs\.org/);
        expect(entry.title).toBeTruthy();
        expect(entry.source).toBe('electron');
      }
    }, 20000);

    it('should contain links to major Electron APIs', async () => {
      const result = await scraper.scrape({});

      expect(result.errors).toBeUndefined();
      
      const expectedAPIs = ['BrowserWindow', 'WebContents', 'app', 'Menu'];
      const entryTitles = result.entries.map(e => e.title.toLowerCase());
      
      // At least some of the major APIs should be present
      const foundAPIs = expectedAPIs.filter(api => 
        entryTitles.some(title => title.includes(api.toLowerCase()))
      );
      
      expect(foundAPIs.length).toBeGreaterThan(0);
    }, 20000);
  });

  describe('URL Structure and Validation', () => {
    it('should construct valid URLs for different API endpoints', async () => {
      const testCases = [
        { apiName: 'BrowserWindow', expectedPath: /api.*browser.*window/i },
        { apiName: 'WebContents', expectedPath: /api.*web.*contents/i },
        { apiName: 'app', expectedPath: /api.*app/i },
      ];

      for (const testCase of testCases) {
        const result = await scraper.scrape({ apiName: testCase.apiName });
        
        if (result.entries.length > 0) {
          const apiEntry = result.entries.find(e => e.type === 'api');
          if (apiEntry) {
            expect(apiEntry.url).toMatch(testCase.expectedPath);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }, 30000);

    it('should handle version-specific URLs correctly', async () => {
      const versions = ['latest', 'v22.0.0'];

      for (const version of versions) {
        const result = await scraper.scrape({ 
          apiName: 'BrowserWindow',
          version
        });

        expect(result.errors).toBeUndefined();
        
        if (result.entries.length > 0) {
          const apiEntry = result.entries.find(e => e.type === 'api');
          if (apiEntry) {
            if (version === 'latest') {
              expect(apiEntry.url).toMatch(/docs\/latest/);
            } else {
              expect(apiEntry.url).toMatch(new RegExp(`docs/${version.replace('.', '\\.')}`));
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }, 20000);
  });

  describe('Content Quality and Structure', () => {
    it('should extract meaningful content from API pages', async () => {
      const result = await scraper.scrape({ apiName: 'BrowserWindow' });

      expect(result.errors).toBeUndefined();
      expect(result.entries).toHaveLength.greaterThan(0);

      const apiEntries = result.entries.filter(e => e.type === 'api');
      expect(apiEntries.length).toBeGreaterThan(0);

      for (const entry of apiEntries) {
        // Content should be substantial
        expect(entry.content.length).toBeGreaterThan(50);
        
        // Should not contain HTML tags (content should be cleaned)
        expect(entry.content).not.toMatch(/<[^>]+>/);
        
        // Should contain meaningful text
        expect(entry.content).toMatch(/[a-zA-Z]+/);
        
        // Title should be meaningful
        expect(entry.title.length).toBeGreaterThan(0);
      }
    }, 20000);

    it('should properly structure code examples', async () => {
      const result = await scraper.scrape({ apiName: 'BrowserWindow' });

      expect(result.errors).toBeUndefined();
      
      const examples = result.entries.filter(e => e.type === 'example');
      
      for (const example of examples) {
        // Examples should have actual code content
        expect(example.content.length).toBeGreaterThan(10);
        
        // Should contain code-like content
        expect(example.content).toMatch(/(const|let|var|function|require|import|new|{|}|\(|\))/);
        
        // Should have language metadata
        expect(example.metadata?.language).toBeDefined();
        
        // Language should be a valid programming language
        const validLanguages = ['javascript', 'typescript', 'js', 'ts', 'jsx', 'tsx'];
        if (example.metadata?.language) {
          expect(validLanguages).toContain(example.metadata.language.toLowerCase());
        }
      }
    }, 20000);

    it('should maintain consistent metadata across entries', async () => {
      const result = await scraper.scrape({ apiName: 'BrowserWindow' });

      expect(result.errors).toBeUndefined();
      expect(result.entries).toHaveLength.greaterThan(0);

      for (const entry of result.entries) {
        // All entries should have required fields
        expect(entry.title).toBeDefined();
        expect(entry.content).toBeDefined();
        expect(entry.url).toBeDefined();
        expect(entry.type).toBeDefined();
        expect(entry.source).toBe('electron');
        expect(entry.lastUpdated).toBeInstanceOf(Date);
        
        // URLs should be valid
        expect(() => new URL(entry.url)).not.toThrow();
        
        // Metadata should indicate Electron docs
        expect(entry.metadata?.parsedFrom).toBe('electron-docs');
      }
    }, 20000);
  });

  describe('Error Resilience', () => {
    it('should handle non-existent API names gracefully', async () => {
      const result = await scraper.scrape({ apiName: 'NonExistentAPI123' });

      // Should either succeed with empty results or fail gracefully
      if (result.errors) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.entries).toHaveLength(0);
      } else {
        // If no errors, entries should be valid (might be empty)
        expect(result.entries).toBeDefined();
      }
    }, 20000);

    it('should handle malformed parameters gracefully', async () => {
      const malformedParams = [
        { apiName: '' },
        { apiName: '   ' },
        { version: '' },
        { type: 'migration', fromVersion: '', toVersion: '' },
        { topic: '' }
      ];

      for (const params of malformedParams) {
        const result = await scraper.scrape(params);
        
        // Should not throw and should return valid structure
        expect(result).toBeDefined();
        expect(result.entries).toBeDefined();
        expect(result.source).toBe('electron');
        expect(result.scrapedAt).toBeInstanceOf(Date);

        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }, 20000);
  });

  describe('Performance and Rate Limiting', () => {
    it('should respect rate limiting during multiple requests', async () => {
      const startTime = Date.now();
      const requests = ['BrowserWindow', 'WebContents', 'Menu'].map(api => 
        scraper.scrape({ apiName: api })
      );

      const results = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // With rate limiting, this should take some minimum time
      expect(duration).toBeGreaterThan(2000); // At least 2 seconds for 3 requests

      // All requests should succeed or fail gracefully
      for (const result of results) {
        expect(result).toBeDefined();
        expect(result.entries).toBeDefined();
      }
    }, 30000);

    it('should handle concurrent requests properly', async () => {
      const concurrentRequests = Array(3).fill(null).map((_, index) => 
        scraper.scrape({ apiName: `BrowserWindow${index ? index : ''}` })
      );

      const results = await Promise.allSettled(concurrentRequests);

      // All promises should resolve (not reject)
      for (const result of results) {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value).toBeDefined();
          expect(result.value.entries).toBeDefined();
        }
      }
    }, 30000);
  });
});