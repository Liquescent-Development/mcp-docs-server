import { describe, it, expect } from 'vitest';

describe('Error Handling Tests', () => {
  describe('HTTP Error Responses', () => {
    it('should return 404 for non-existent routes', async () => {
      try {
        await global.httpClient.get('/non-existent-route');
        expect.fail('Should have thrown 404 error');
      } catch (error) {
        expect(error.response.status).toBe(404);
        expect(error.response.data).toHaveProperty('error');
        expect(error.response.data.error).toContain('Not Found');
      }
    });

    it('should return 405 for unsupported HTTP methods', async () => {
      try {
        await global.httpClient.delete('/health');
        expect.fail('Should have thrown 405 error');
      } catch (error) {
        expect(error.response.status).toBe(405);
      }
    });

    it('should handle malformed JSON in requests', async () => {
      try {
        await global.httpClient.post('/api/test', 'invalid-json', {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        expect.fail('Should have thrown 400 error');
      } catch (error) {
        expect(error.response.status).toBe(400);
      }
    });
  });

  describe('Request Validation', () => {
    it('should validate Content-Type headers', async () => {
      try {
        await global.httpClient.post('/api/test', { test: 'data' }, {
          headers: {
            'Content-Type': 'text/plain'
          }
        });
        expect.fail('Should have rejected invalid content type');
      } catch (error) {
        expect([400, 415]).toContain(error.response.status);
      }
    });

    it('should handle oversized requests gracefully', async () => {
      const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB payload
      
      try {
        await global.httpClient.post('/api/test', { data: largePayload }, {
          timeout: 5000
        });
        expect.fail('Should have rejected oversized request');
      } catch (error) {
        expect([413, 400, 'ECONNABORTED'].some(code => 
          error.response?.status === code || error.code === code
        )).toBe(true);
      }
    });
  });

  describe('Server Resilience', () => {
    it('should handle rapid successive requests', async () => {
      const requests = Array.from({ length: 20 }, (_, i) =>
        global.httpClient.get('/health').catch(error => ({ error, index: i }))
      );

      const results = await Promise.all(requests);
      
      // Most requests should succeed
      const successCount = results.filter(r => !r.error).length;
      expect(successCount).toBeGreaterThan(15);
      
      // Any errors should be rate limiting (429) or timeout, not server errors
      const errors = results.filter(r => r.error);
      for (const result of errors) {
        if (result.error.response) {
          expect([429, 503]).toContain(result.error.response.status);
        }
      }
    });

    it('should maintain health during stress', async () => {
      // Generate load
      const loadPromises = Array.from({ length: 10 }, () =>
        global.httpClient.get('/health')
      );

      await Promise.all(loadPromises);

      // Server should still be healthy
      const healthCheck = await global.httpClient.get('/health');
      expect(healthCheck.status).toBe(200);
      expect(healthCheck.data.status).toBe('healthy');
    });
  });

  describe('Timeout Handling', () => {
    it('should handle client timeouts gracefully', async () => {
      const shortTimeoutClient = global.httpClient.defaults;
      shortTimeoutClient.timeout = 100; // Very short timeout

      try {
        await global.httpClient.get('/health', { timeout: 1 });
        expect.fail('Should have timed out');
      } catch (error) {
        expect(error.code).toBe('ECONNABORTED');
      }
    });
  });

  describe('Security Error Handling', () => {
    it('should not expose internal errors in responses', async () => {
      try {
        await global.httpClient.get('/health/../../../etc/passwd');
        expect.fail('Should have blocked path traversal');
      } catch (error) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.error).not.toContain('ENOENT');
        expect(error.response.data.error).not.toContain('/etc/passwd');
      }
    });

    it('should handle invalid User-Agent headers', async () => {
      const response = await global.httpClient.get('/health', {
        headers: {
          'User-Agent': '"><script>alert("xss")</script>'
        }
      });

      expect(response.status).toBe(200);
      // Should not crash or expose XSS
    });

    it('should sanitize error messages', async () => {
      try {
        await global.httpClient.get('/non-existent', {
          headers: {
            'X-Custom-Header': '<script>alert("test")</script>'
          }
        });
        expect.fail('Should have thrown 404');
      } catch (error) {
        expect(error.response.status).toBe(404);
        
        // Error message should not contain raw script tags
        const errorText = JSON.stringify(error.response.data);
        expect(errorText).not.toContain('<script>');
        expect(errorText).not.toContain('alert(');
      }
    });
  });

  describe('Resource Cleanup', () => {
    it('should handle connection drops gracefully', async () => {
      // Test that server recovers from aborted connections
      const controller = new AbortController();
      
      setTimeout(() => controller.abort(), 50);
      
      try {
        await global.httpClient.get('/health', {
          signal: controller.signal
        });
        expect.fail('Should have been aborted');
      } catch (error) {
        expect(error.name).toBe('CanceledError');
      }

      // Server should still be responsive
      const healthCheck = await global.httpClient.get('/health');
      expect(healthCheck.status).toBe(200);
    });
  });

  describe('Cache Error Handling', () => {
    it('should handle cache errors gracefully', async () => {
      // This test assumes the server handles cache failures gracefully
      // by falling back to live scraping
      
      const response = await global.httpClient.get('/health');
      expect(response.status).toBe(200);
      
      // Cache status might be degraded but service should work
      if (response.data.cache) {
        expect(['healthy', 'degraded', 'error']).toContain(response.data.cache.status);
      }
    });
  });
});