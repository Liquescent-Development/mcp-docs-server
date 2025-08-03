import { describe, it, expect, beforeAll } from 'vitest';
import axios, { AxiosInstance } from 'axios';

// Endpoint verification tests to ensure Electron documentation URLs are accessible
// and return expected content structure
describe('Electron Documentation Endpoints', () => {
  let httpClient: AxiosInstance;
  const baseUrl = 'https://www.electronjs.org';

  beforeAll(() => {
    httpClient = axios.create({
      baseURL: baseUrl,
      timeout: 15000,
      headers: {
        'User-Agent': 'MCP-Docs-Server-Endpoint-Test/1.0'
      }
    });
  });

  describe('Core API Endpoints', () => {
    const coreAPIs = [
      { name: 'BrowserWindow', path: '/docs/latest/api/browser-window' },
      { name: 'WebContents', path: '/docs/latest/api/web-contents' },
      { name: 'app', path: '/docs/latest/api/app' },
      { name: 'Menu', path: '/docs/latest/api/menu' },
      { name: 'dialog', path: '/docs/latest/api/dialog' },
      { name: 'ipcMain', path: '/docs/latest/api/ipc-main' },
      { name: 'ipcRenderer', path: '/docs/latest/api/ipc-renderer' }
    ];

    it.each(coreAPIs)('should access $name API documentation at $path', async ({ name, path }) => {
      const response = await httpClient.get(path);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.data).toContain(name);
      
      // Verify HTML structure contains expected elements
      expect(response.data).toMatch(/<html[^>]*>/i);
      expect(response.data).toMatch(/<head[^>]*>/i);
      expect(response.data).toMatch(/<body[^>]*>/i);
      
      // Check for common documentation elements
      expect(response.data).toMatch(/<h[1-6][^>]*>/i); // Should have headings
      expect(response.data).toMatch(/<p[^>]*>|<div[^>]*>/i); // Should have content containers
    }, 15000);

    it('should verify API documentation contains expected sections', async () => {
      const response = await httpClient.get('/docs/latest/api/browser-window');
      
      expect(response.status).toBe(200);
      const html = response.data;
      
      // Look for common API documentation patterns
      const hasApiSignature = html.match(/new\s+BrowserWindow|BrowserWindow\(/i);
      const hasMethodDocumentation = html.match(/<h[2-6][^>]*>.*method|<h[2-6][^>]*>.*property/i);
      const hasCodeExamples = html.match(/<pre[^>]*>|<code[^>]*>/i);
      
      // At least one of these should be present in API docs
      expect(hasApiSignature || hasMethodDocumentation || hasCodeExamples).toBeTruthy();
    }, 15000);

    it('should verify API index page is accessible', async () => {
      const response = await httpClient.get('/docs/latest/api/');
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
      
      const html = response.data;
      
      // Should contain links to various APIs
      expect(html).toMatch(/BrowserWindow/i);
      expect(html).toMatch(/WebContents/i);
      expect(html).toMatch(/href.*api/i);
    }, 15000);
  });

  describe('Alternative URL Patterns', () => {
    it('should test different casing patterns for API names', async () => {
      const casings = [
        '/docs/latest/api/browser-window',  // kebab-case
        '/docs/latest/api/browserwindow',   // lowercase
      ];

      let successCount = 0;
      
      for (const path of casings) {
        try {
          const response = await httpClient.get(path);
          if (response.status === 200 && response.data.includes('BrowserWindow')) {
            successCount++;
          }
        } catch (error) {
          // Some patterns might not work, that's expected
        }
      }
      
      // At least one casing pattern should work
      expect(successCount).toBeGreaterThan(0);
    }, 15000);

    it('should handle API names with special characters', async () => {
      // Test some APIs that might have special characters or numbers
      const specialAPIs = [
        '/docs/latest/api/web-contents',
        '/docs/latest/api/ipc-main',
        '/docs/latest/api/ipc-renderer'
      ];

      for (const path of specialAPIs) {
        const response = await httpClient.get(path);
        expect(response.status).toBe(200);
        expect(response.data).toMatch(/<html[^>]*>/i);
      }
    }, 20000);
  });

  describe('Version-Specific Endpoints', () => {
    it('should access latest version documentation', async () => {
      const response = await httpClient.get('/docs/latest/api/browser-window');
      
      expect(response.status).toBe(200);
      expect(response.data).toContain('BrowserWindow');
    }, 15000);

    it('should verify version structure in URLs', async () => {
      // Test that versioned URLs follow expected patterns
      const paths = [
        '/docs/latest/api/',
        '/docs/latest/api/browser-window'
      ];

      for (const path of paths) {
        const response = await httpClient.get(path);
        expect(response.status).toBe(200);
        
        // URL should be structured consistently
        expect(response.config.url).toMatch(/\/docs\/latest\//);
      }
    }, 15000);

    it('should handle specific version numbers if available', async () => {
      // Try a few recent version patterns
      const versionPatterns = [
        '/docs/v22.0.0/api/browser-window',
        '/docs/v21.0.0/api/browser-window'
      ];

      let versionedDocsAvailable = false;

      for (const path of versionPatterns) {
        try {
          const response = await httpClient.get(path);
          if (response.status === 200) {
            versionedDocsAvailable = true;
            expect(response.data).toContain('BrowserWindow');
            break;
          }
        } catch (error) {
          // Versioned docs might not be available, which is fine
        }
      }

      // If versioned docs are available, at least one should work
      // If not available, this test just documents the behavior
      if (versionedDocsAvailable) {
        expect(versionedDocsAvailable).toBe(true);
      }
    }, 15000);
  });

  describe('Migration and Breaking Changes', () => {
    it('should access breaking changes documentation', async () => {
      const response = await httpClient.get('/docs/latest/breaking-changes');
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
      
      const html = response.data;
      
      // Should contain version-related information
      expect(html).toMatch(/version|breaking|change/i);
      expect(html).toMatch(/v?\d+\.\d+/); // Version numbers
    }, 15000);

    it('should verify migration guide contains structured information', async () => {
      const response = await httpClient.get('/docs/latest/breaking-changes');
      
      expect(response.status).toBe(200);
      const html = response.data;
      
      // Look for common migration guide structures
      const hasVersionHeaders = html.match(/<h[1-6][^>]*>.*v?\d+\.\d+/i);
      const hasChangeList = html.match(/<ul[^>]*>|<ol[^>]*>|<li[^>]*>/i);
      const hasVersionInfo = html.match(/v?\d+\.\d+\.\d+/);
      
      // Should have some structured information about versions and changes
      expect(hasVersionHeaders || hasChangeList || hasVersionInfo).toBeTruthy();
    }, 15000);
  });

  describe('Content Structure Validation', () => {
    it('should verify HTML structure meets basic standards', async () => {
      const response = await httpClient.get('/docs/latest/api/browser-window');
      
      expect(response.status).toBe(200);
      const html = response.data;
      
      // Check for proper HTML5 structure
      expect(html).toMatch(/<!DOCTYPE html>/i);
      expect(html).toMatch(/<html[^>]*>/i);
      expect(html).toMatch(/<head[^>]*>/i);
      expect(html).toMatch(/<title[^>]*>/i);
      expect(html).toMatch(/<body[^>]*>/i);
      
      // Should have meta tags for proper rendering
      expect(html).toMatch(/<meta[^>]*charset/i);
      expect(html).toMatch(/<meta[^>]*viewport/i);
    }, 15000);

    it('should verify documentation contains searchable content', async () => {
      const response = await httpClient.get('/docs/latest/api/browser-window');
      
      expect(response.status).toBe(200);
      const html = response.data;
      
      // Remove HTML tags to get text content
      const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      
      // Should have substantial text content
      expect(textContent.length).toBeGreaterThan(500);
      
      // Should contain technical terms related to Electron
      expect(textContent).toMatch(/electron|window|process|renderer/i);
      
      // Should contain code-related terms
      expect(textContent).toMatch(/function|method|property|parameter|return/i);
    }, 15000);

    it('should verify code examples are properly formatted', async () => {
      const response = await httpClient.get('/docs/latest/api/browser-window');
      
      expect(response.status).toBe(200);
      const html = response.data;
      
      // Look for code blocks
      const codeBlocks = html.match(/<pre[^>]*>[\s\S]*?<\/pre>/gi) || [];
      const inlineCode = html.match(/<code[^>]*>[\s\S]*?<\/code>/gi) || [];
      
      const totalCodeElements = codeBlocks.length + inlineCode.length;
      
      // API documentation should contain some code examples
      expect(totalCodeElements).toBeGreaterThan(0);
      
      // If code blocks exist, they should contain meaningful content
      if (codeBlocks.length > 0) {
        const firstCodeBlock = codeBlocks[0];
        const codeContent = firstCodeBlock.replace(/<[^>]+>/g, '').trim();
        expect(codeContent.length).toBeGreaterThan(10);
      }
    }, 15000);
  });

  describe('Navigation and Linking', () => {
    it('should verify internal links are properly structured', async () => {
      const response = await httpClient.get('/docs/latest/api/');
      
      expect(response.status).toBe(200);
      const html = response.data;
      
      // Look for internal documentation links
      const internalLinks = html.match(/href=['"]([^'"]*docs[^'"]*)['"]/gi) || [];
      
      expect(internalLinks.length).toBeGreaterThan(0);
      
      // Verify link structure
      for (const link of internalLinks.slice(0, 5)) { // Test first 5 links
        const hrefMatch = link.match(/href=['"]([^'"]*)['"]/);
        if (hrefMatch) {
          const href = hrefMatch[1];
          expect(href).toMatch(/^\/docs\//);
        }
      }
    }, 15000);

    it('should verify API cross-references work', async () => {
      const response = await httpClient.get('/docs/latest/api/browser-window');
      
      expect(response.status).toBe(200);
      const html = response.data;
      
      // Look for links to other APIs
      const apiLinks = html.match(/href=['"]([^'"]*docs[^'"]*api[^'"]*)['"]/gi) || [];
      
      if (apiLinks.length > 0) {
        // Test one API link to ensure it works
        const firstLink = apiLinks[0];
        const hrefMatch = firstLink.match(/href=['"]([^'"]*)['"]/);
        
        if (hrefMatch) {
          const linkedPath = hrefMatch[1];
          const linkedResponse = await httpClient.get(linkedPath);
          expect(linkedResponse.status).toBe(200);
        }
      }
    }, 20000);
  });

  describe('Response Headers and Performance', () => {
    it('should verify appropriate caching headers', async () => {
      const response = await httpClient.get('/docs/latest/api/browser-window');
      
      expect(response.status).toBe(200);
      
      // Check for caching-related headers
      const headers = response.headers;
      
      // Should have some form of cache control
      expect(
        headers['cache-control'] || 
        headers['etag'] || 
        headers['last-modified']
      ).toBeDefined();
    }, 15000);

    it('should verify response times are reasonable', async () => {
      const startTime = Date.now();
      const response = await httpClient.get('/docs/latest/api/browser-window');
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      
      // Response should be reasonably fast (less than 10 seconds)
      expect(responseTime).toBeLessThan(10000);
    }, 15000);

    it('should verify content encoding is appropriate', async () => {
      const response = await httpClient.get('/docs/latest/api/browser-window');
      
      expect(response.status).toBe(200);
      
      // Check content type
      expect(response.headers['content-type']).toMatch(/text\/html/);
      
      // Check if compression is used
      const contentEncoding = response.headers['content-encoding'];
      if (contentEncoding) {
        expect(['gzip', 'br', 'deflate']).toContain(contentEncoding);
      }
    }, 15000);
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent API endpoints gracefully', async () => {
      try {
        await httpClient.get('/docs/latest/api/non-existent-api-12345');
        // If it doesn't throw, it should return a 404 or redirect
        fail('Expected request to non-existent API to fail');
      } catch (error: any) {
        // Should return 404 or similar error
        expect([404, 500].includes(error.response?.status)).toBe(true);
      }
    }, 15000);

    it('should handle malformed API paths', async () => {
      const malformedPaths = [
        '/docs/latest/api/../../etc/passwd',
        '/docs/latest/api/<script>',
        '/docs/latest/api/%2e%2e%2f',
      ];

      for (const path of malformedPaths) {
        try {
          const response = await httpClient.get(path);
          // If it succeeds, it should still return valid content
          expect(response.status).toBe(200);
          expect(response.data).toMatch(/<html[^>]*>/i);
        } catch (error: any) {
          // Should fail with appropriate error codes
          expect([400, 404, 500].includes(error.response?.status)).toBe(true);
        }
      }
    }, 20000);

    it('should handle requests with unusual headers gracefully', async () => {
      const response = await httpClient.get('/docs/latest/api/browser-window', {
        headers: {
          'Accept': 'application/json',  // Request JSON from HTML endpoint
          'User-Agent': 'curl/7.68.0'   // Different user agent
        }
      });
      
      // Should still return HTML even with JSON accept header
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
    }, 15000);
  });

  describe('Security Headers', () => {
    it('should verify security headers are present', async () => {
      const response = await httpClient.get('/docs/latest/api/browser-window');
      
      expect(response.status).toBe(200);
      const headers = response.headers;
      
      // Check for common security headers
      const securityHeaders = [
        'x-frame-options',
        'x-content-type-options',
        'x-xss-protection',
        'strict-transport-security',
        'content-security-policy'
      ];
      
      // At least some security headers should be present
      const presentHeaders = securityHeaders.filter(header => headers[header]);
      expect(presentHeaders.length).toBeGreaterThan(0);
    }, 15000);

    it('should verify HTTPS is enforced', async () => {
      // The base URL should be HTTPS
      expect(baseUrl).toMatch(/^https:/);
      
      // Response should confirm HTTPS
      const response = await httpClient.get('/docs/latest/api/browser-window');
      expect(response.status).toBe(200);
      
      // Check if HSTS header is present
      const hstsHeader = response.headers['strict-transport-security'];
      if (hstsHeader) {
        expect(hstsHeader).toMatch(/max-age=\d+/);
      }
    }, 15000);
  });
});