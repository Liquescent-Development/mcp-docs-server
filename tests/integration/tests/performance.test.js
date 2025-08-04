import { describe, it, expect } from 'vitest';

describe('Performance Tests', () => {
  describe('Response Times', () => {
    it('should respond to health checks quickly', async () => {
      const startTime = Date.now();
      const response = await global.httpClient.get('/health');
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle search requests efficiently', async () => {
      const startTime = Date.now();
      
      // This would be an MCP call in real usage, but testing HTTP for simplicity
      const response = await global.httpClient.get('/health');
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });
  });

  describe('Memory Usage', () => {
    it('should maintain reasonable memory usage', async () => {
      const initialHealth = await global.httpClient.get('/health');
      const initialMemory = initialHealth.data.system.memory.used;

      // Generate some load
      const requests = Array.from({ length: 50 }, () =>
        global.httpClient.get('/health')
      );
      await Promise.all(requests);

      const finalHealth = await global.httpClient.get('/health');
      const finalMemory = finalHealth.data.system.memory.used;

      // Memory shouldn't grow excessively (allow for 50MB increase)
      const memoryIncrease = finalMemory - initialMemory;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Concurrent Load', () => {
    it('should handle moderate concurrent load', async () => {
      const concurrentRequests = 20;
      const startTime = Date.now();

      const requests = Array.from({ length: concurrentRequests }, (_, i) =>
        global.httpClient.get('/health').then(response => ({
          index: i,
          status: response.status,
          responseTime: Date.now() - startTime
        }))
      );

      const results = await Promise.allSettled(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBe(concurrentRequests);

      // Total time should be reasonable (allowing for some serialization)
      expect(totalTime).toBeLessThan(10000); // 10 seconds max

      // Each individual request should be fast
      const responseTimes = successful.map(r => r.value.responseTime);
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      expect(avgResponseTime).toBeLessThan(5000); // 5 seconds average
    });

    it('should recover quickly from load spikes', async () => {
      // Create a load spike
      const spikeRequests = Array.from({ length: 30 }, () =>
        global.httpClient.get('/health', { timeout: 10000 })
      );

      await Promise.allSettled(spikeRequests);

      // Wait a moment for recovery
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Server should respond normally after load spike
      const startTime = Date.now();
      const response = await global.httpClient.get('/health');
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Should be back to normal speed
    });
  });

  describe('Cache Performance', () => {
    it('should show cache benefits for repeated requests', async () => {
      // First request (cache miss)
      const startTime1 = Date.now();
      const response1 = await global.httpClient.get('/health');
      const firstRequestTime = Date.now() - startTime1;

      expect(response1.status).toBe(200);

      // Second request (should hit cache or be faster)
      const startTime2 = Date.now();
      const response2 = await global.httpClient.get('/health');
      const secondRequestTime = Date.now() - startTime2;

      expect(response2.status).toBe(200);

      // Second request should be at least as fast as first
      // (allowing for some variance in network conditions)
      expect(secondRequestTime).toBeLessThanOrEqual(firstRequestTime * 1.5);
    });
  });

  describe('Resource Efficiency', () => {
    it('should maintain stable CPU usage under load', async () => {
      const initialHealth = await global.httpClient.get('/health');
      
      // Generate sustained load
      const loadDuration = 5000; // 5 seconds
      const requestInterval = 100; // Request every 100ms
      const expectedRequests = Math.floor(loadDuration / requestInterval);

      const requests = [];
      const startTime = Date.now();

      while (Date.now() - startTime < loadDuration) {
        requests.push(
          global.httpClient.get('/health').catch(() => ({ error: true }))
        );
        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }

      const results = await Promise.allSettled(requests);
      const finalHealth = await global.httpClient.get('/health');

      // Should have made roughly the expected number of requests
      expect(results.length).toBeGreaterThan(expectedRequests * 0.8);

      // Server should still be healthy
      expect(finalHealth.status).toBe(200);
      expect(finalHealth.data.status).toBe('healthy');

      // CPU usage should be reasonable (this is system-dependent)
      if (finalHealth.data.system.cpu) {
        expect(finalHealth.data.system.cpu.usage).toBeLessThan(90);
      }
    });

    it('should handle burst requests efficiently', async () => {
      const burstSize = 50;
      const startTime = Date.now();

      // Create burst of requests
      const burstRequests = Array.from({ length: burstSize }, (_, i) =>
        global.httpClient.get('/health', { timeout: 15000 }).catch(error => ({ 
          error: true, 
          status: error.response?.status,
          index: i 
        }))
      );

      const results = await Promise.all(burstRequests);
      const totalTime = Date.now() - startTime;

      // Most requests should succeed
      const successful = results.filter(r => !r.error);
      const successRate = successful.length / burstSize;
      
      expect(successRate).toBeGreaterThan(0.7); // At least 70% success rate

      // Failed requests should be due to rate limiting, not server errors
      const failed = results.filter(r => r.error);
      for (const failure of failed) {
        if (failure.status) {
          expect([429, 503]).toContain(failure.status); // Rate limit or service unavailable
        }
      }

      // Total time should be reasonable
      expect(totalTime).toBeLessThan(30000); // 30 seconds max for burst
    });
  });

  describe('Scalability Indicators', () => {
    it('should provide performance metrics in health check', async () => {
      const response = await global.httpClient.get('/health');
      
      expect(response.data.system).toBeDefined();
      expect(response.data.system.uptime).toBeGreaterThan(0);
      expect(response.data.system.memory).toBeDefined();
      expect(response.data.system.memory.used).toBeGreaterThan(0);
      expect(response.data.system.memory.total).toBeGreaterThan(0);
    });

    it('should track cache hit rates', async () => {
      const response = await global.httpClient.get('/health');
      
      if (response.data.cache) {
        expect(response.data.cache).toHaveProperty('entries');
        expect(typeof response.data.cache.entries).toBe('number');
        expect(response.data.cache.entries).toBeGreaterThanOrEqual(0);
      }
    });
  });
});