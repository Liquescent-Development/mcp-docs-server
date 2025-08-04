import { describe, it, expect } from 'vitest';

describe('MCP HTTP Transport Tests', () => {
  describe('SSE Endpoint', () => {
    it('should establish SSE connection', async () => {
      const response = await fetch(`${global.MCP_SERVER_URL}/mcp`, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
      expect(response.headers.get('cache-control')).toBe('no-cache');
      expect(response.headers.get('connection')).toBe('keep-alive');
      
      // Close the connection
      response.body?.cancel();
    });

    it('should return endpoint information in SSE stream', async () => {
      const response = await fetch(`${global.MCP_SERVER_URL}/mcp`, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream'
        }
      });

      expect(response.ok).toBe(true);
      
      const reader = response.body?.getReader();
      if (reader) {
        const { value } = await reader.read();
        const sseData = new TextDecoder().decode(value);
        
        // Should contain endpoint event with session information
        expect(sseData).toContain('event: endpoint');
        expect(sseData).toContain('data: ');
        expect(sseData).toContain('/mcp?sessionId=');
        
        reader.releaseLock();
      }
      
      response.body?.cancel();
    });
  });

  describe('POST Endpoint', () => {
    it('should require sessionId parameter', async () => {
      const response = await fetch(`${global.MCP_SERVER_URL}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: { tools: {} },
            clientInfo: { name: 'test-client', version: '1.0.0' }
          }
        })
      });

      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toBe('Missing sessionId parameter');
    });

    it('should return 404 for invalid session', async () => {
      const response = await fetch(`${global.MCP_SERVER_URL}/mcp?sessionId=invalid-session-id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping'
        })
      });

      expect(response.status).toBe(404);
      const text = await response.text();
      expect(text).toBe('Session not found');
    });
  });

  describe('CORS Support', () => {
    it('should handle OPTIONS requests', async () => {
      const response = await fetch(`${global.MCP_SERVER_URL}/mcp`, {
        method: 'OPTIONS'
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS');
      expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type');
    });

    it('should include CORS headers on all responses', async () => {
      const response = await fetch(`${global.MCP_SERVER_URL}/health`);

      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS');
      expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type');
    });
  });
});