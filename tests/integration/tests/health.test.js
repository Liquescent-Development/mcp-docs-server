import { describe, it, expect } from 'vitest';

describe('Health Check Tests', () => {
  it('should return 200 for health endpoint', async () => {
    const response = await global.httpClient.get('/health');
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('status', 'healthy');
    expect(response.data).toHaveProperty('timestamp');
    expect(response.data).toHaveProperty('version');
  });

  it('should include system information in health check', async () => {
    const response = await global.httpClient.get('/health');
    
    expect(response.data).toHaveProperty('system');
    expect(response.data.system).toHaveProperty('uptime');
    expect(response.data.system).toHaveProperty('memory');
    expect(response.data.system).toHaveProperty('nodeVersion');
  });

  it('should include cache information in health check', async () => {
    const response = await global.httpClient.get('/health');
    
    expect(response.data).toHaveProperty('cache');
    expect(response.data.cache).toHaveProperty('status');
    expect(response.data.cache).toHaveProperty('entries');
  });

  it('should include scraper status in health check', async () => {
    const response = await global.httpClient.get('/health');
    
    expect(response.data).toHaveProperty('scrapers');
    expect(Array.isArray(response.data.scrapers)).toBe(true);
    
    // Should have at least electron, react, node, github scrapers
    const scraperNames = response.data.scrapers.map(s => s.name);
    expect(scraperNames).toContain('electron');
    expect(scraperNames).toContain('react');
    expect(scraperNames).toContain('node');
    expect(scraperNames).toContain('github');
  });

  it('should handle 404 for non-existent endpoints', async () => {
    try {
      await global.httpClient.get('/non-existent-endpoint');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(404);
    }
  });

  it('should have proper CORS headers', async () => {
    const response = await global.httpClient.get('/health');
    
    expect(response.headers).toHaveProperty('access-control-allow-origin');
    expect(response.headers).toHaveProperty('access-control-allow-methods');
  });
});