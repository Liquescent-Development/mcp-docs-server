import { describe, it, expect } from 'vitest';

describe('Health Check Tests', () => {
  it('should return 200 for health endpoint', async () => {
    const response = await fetch(`${global.MCP_SERVER_URL}/health`);
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status', 'healthy');
    expect(data).toHaveProperty('service', 'mcp-docs-server');
    expect(data).toHaveProperty('timestamp');
  });

  it('should have proper timestamp format', async () => {
    const response = await fetch(`${global.MCP_SERVER_URL}/health`);
    const data = await response.json();
    
    expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    
    // Timestamp should be recent (within last 10 seconds)
    const timestamp = new Date(data.timestamp);
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    expect(diffMs).toBeLessThan(10000);
  });

  it('should return 404 for non-existent endpoints', async () => {
    const response = await fetch(`${global.MCP_SERVER_URL}/non-existent-endpoint`);
    expect(response.status).toBe(404);
  });

  it('should handle HEAD requests to health endpoint', async () => {
    const response = await fetch(`${global.MCP_SERVER_URL}/health`, {
      method: 'HEAD'
    });
    
    expect(response.status).toBe(200);
  });

  it('should have proper content-type headers', async () => {
    const response = await fetch(`${global.MCP_SERVER_URL}/health`);
    
    expect(response.headers.get('content-type')).toBe('application/json');
  });
});