import { describe, it, expect } from 'vitest';

describe('Security Validation Tests', () => {
  let sessionId = null;
  let messageId = 1;
  let sseConnection = null;

  async function getSessionId() {
    if (sessionId) return sessionId;
    
    const response = await fetch(`${global.MCP_SERVER_URL}/mcp`, {
      method: 'GET',
      headers: { 'Accept': 'text/event-stream' }
    });
    
    const reader = response.body?.getReader();
    if (reader) {
      const { value } = await reader.read();
      const sseData = new TextDecoder().decode(value);
      const match = sseData.match(/sessionId=([a-f0-9-]+)/);
      sessionId = match ? match[1] : null;
      reader.releaseLock();
    }
    
    // Keep the SSE connection alive for POST requests
    sseConnection = response;
    
    return sessionId;
  }

  afterAll(() => {
    // Clean up SSE connection
    if (sseConnection) {
      sseConnection.body?.cancel();
    }
  });

  async function sendMCPMessage(method, params = {}) {
    const sid = await getSessionId();
    const message = {
      jsonrpc: '2.0',
      id: messageId++,
      method,
      params
    };

    const response = await fetch(`${global.MCP_SERVER_URL}/mcp?sessionId=${sid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    return response;
  }

  beforeEach(async () => {
    // Initialize session for each test
    await sendMCPMessage('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: { tools: {} },
      clientInfo: { name: 'test-client', version: '1.0.0' }
    });
  });

  describe('Input Sanitization', () => {
    it('should handle XSS attempts in search queries', async () => {
      const maliciousQuery = '<script>alert("xss")</script>';
      
      const response = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: maliciousQuery,
          sources: ['react']
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      // Should either sanitize or return error, but not execute script
      if (result.result) {
        const content = JSON.stringify(result.result);
        expect(content).not.toContain('<script>');
        expect(content).not.toContain('alert(');
        // XSS should be sanitized - the query should be sanitized to [sanitized]
        expect(content).toContain('[sanitized]');
      }
    });

    it('should handle SQL injection attempts', async () => {
      const sqlInjection = "'; DROP TABLE users; --";
      
      const response = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: sqlInjection,
          sources: ['react']
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      // Should handle gracefully without crashing
      expect(result).toBeDefined();
      if (result.error) {
        expect(result.error.code).toBeDefined();
      }
    });

    it('should handle extremely long input strings', async () => {
      const longQuery = 'a'.repeat(10000); // 10KB string
      
      const response = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: longQuery,
          sources: ['react']
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      // Should either handle or return appropriate error
      expect(result).toBeDefined();
      if (result.error) {
        expect(result.error.code).toBeDefined();
      }
    });

    it('should validate source parameter values', async () => {
      const response = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 'test',
          sources: ['../../../etc/passwd'] // Path traversal attempt
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      // Should reject invalid source or sanitize it
      if (result.error) {
        expect(result.error.code).toBeDefined();
      } else {
        // If successful, ensure no sensitive data is exposed
        const content = JSON.stringify(result.result);
        expect(content).not.toContain('/etc/passwd');
        expect(content).not.toContain('root:');
      }
    });
  });

  describe('Request Size Limits', () => {
    it('should handle large JSON payloads', async () => {
      const largeObject = {
        query: 'test',
        sources: ['react'],
        // Add large data
        largeField: 'x'.repeat(50000) // 50KB
      };

      const sid = await getSessionId();
      const response = await fetch(`${global.MCP_SERVER_URL}/mcp?sessionId=${sid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: messageId++,
          method: 'tools/call',
          params: {
            name: 'search_documentation',
            arguments: largeObject
          }
        })
      });

      // Should either handle or reject gracefully
      expect([200, 413, 400].includes(response.status)).toBe(true);
      
      if (response.status === 200) {
        const result = await response.json();
        expect(result).toBeDefined();
      }
    });

    it('should handle malformed JSON gracefully', async () => {
      const sid = await getSessionId();
      
      const response = await fetch(`${global.MCP_SERVER_URL}/mcp?sessionId=${sid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ "jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": { malformed json'
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32700); // Parse error
    });
  });

  describe('Session Security', () => {
    it('should generate unique session IDs', async () => {
      const sessionIds = [];
      
      for (let i = 0; i < 5; i++) {
        const response = await fetch(`${global.MCP_SERVER_URL}/mcp`, {
          method: 'GET',
          headers: { 'Accept': 'text/event-stream' }
        });
        
        const reader = response.body?.getReader();
        if (reader) {
          const { value } = await reader.read();
          const sseData = new TextDecoder().decode(value);
          const match = sseData.match(/sessionId=([a-f0-9-]+)/);
          if (match) {
            sessionIds.push(match[1]);
          }
          reader.releaseLock();
        }
        response.body?.cancel();
      }
      
      expect(sessionIds.length).toBe(5);
      expect(new Set(sessionIds).size).toBe(5); // All unique
      
      // Session IDs should be UUIDs (36 chars with hyphens)
      sessionIds.forEach(id => {
        expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
      });
    });

    it('should isolate sessions from each other', async () => {
      // This test verifies that sessions are properly managed
      // Since our implementation requires active SSE connections, 
      // we'll test that sessions work correctly when active
      
      // Use the main session which is kept alive
      const sid = await getSessionId();
      
      // Initialize the session
      const initResponse = await fetch(`${global.MCP_SERVER_URL}/mcp?sessionId=${sid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: { tools: {} },
            clientInfo: { name: 'client1', version: '1.0.0' }
          }
        })
      });
      
      expect(initResponse.status).toBe(200);
      
      // Verify that a bogus session ID fails
      const invalidSessionResponse = await fetch(`${global.MCP_SERVER_URL}/mcp?sessionId=invalid-session-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        })
      });
      
      expect(invalidSessionResponse.status).toBe(404);
      
      // Verify that the valid session still works
      const validSessionResponse = await fetch(`${global.MCP_SERVER_URL}/mcp?sessionId=${sid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {}
        })
      });
      
      expect(validSessionResponse.status).toBe(200);
      const result = await validSessionResponse.json();
      expect(result).toBeDefined();
      expect(result.result).toBeDefined();
    });

    it('should handle concurrent requests to same session', async () => {
      const sid = await getSessionId();
      
      // Initialize session
      await sendMCPMessage('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        clientInfo: { name: 'test-client', version: '1.0.0' }
      });

      // Send multiple concurrent requests
      const promises = Array.from({ length: 3 }, (_, i) => 
        fetch(`${global.MCP_SERVER_URL}/mcp?sessionId=${sid}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: i + 100,
            method: 'tools/list',
            params: {}
          })
        })
      );

      const responses = await Promise.all(promises);
      
      // All should succeed or fail gracefully
      responses.forEach((response, i) => {
        expect(response.status).toBe(200);
      });
      
      const results = await Promise.all(responses.map(r => r.json()));
      
      // Each should have corresponding ID
      results.forEach((result, i) => {
        expect(result.id).toBe(i + 100);
        expect(result.jsonrpc).toBe('2.0');
      });
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose internal paths in error messages', async () => {
      const response = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 'test',
          sources: ['nonexistent_source']
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      if (result.error) {
        const errorMessage = result.error.message.toLowerCase();
        // Should not expose internal file paths
        expect(errorMessage).not.toMatch(/\/usr\/|\/var\/|\/home\/|\/app\/|c:\\/);
        expect(errorMessage).not.toContain('node_modules');
        expect(errorMessage).not.toContain('src/');
      }
    });

    it('should not expose stack traces to clients', async () => {
      // Try to trigger an error condition
      const response = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: null, // Invalid type that might cause internal error
          sources: ['react']
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      if (result.error) {
        const errorContent = JSON.stringify(result.error);
        // Should not contain stack trace information
        expect(errorContent).not.toContain('at ');
        expect(errorContent).not.toContain('.js:');
        expect(errorContent).not.toContain('stack');
        expect(errorContent).not.toContain('Error:');
      }
    });
  });

  describe('Rate Limiting and DoS Protection', () => {
    it('should handle rapid successive requests gracefully', async () => {
      const sid = await getSessionId();
      
      // Initialize session
      await sendMCPMessage('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        clientInfo: { name: 'test-client', version: '1.0.0' }
      });

      // Send many requests quickly
      const promises = Array.from({ length: 20 }, (_, i) => 
        fetch(`${global.MCP_SERVER_URL}/mcp?sessionId=${sid}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: i + 200,
            method: 'tools/list',
            params: {}
          })
        })
      );

      const responses = await Promise.all(promises);
      
      // Should handle all requests without crashing
      responses.forEach(response => {
        expect([200, 429].includes(response.status)).toBe(true);
      });
      
      // Most should succeed (rate limiting is lenient in test environment)
      const successful = responses.filter(r => r.status === 200);
      expect(successful.length).toBeGreaterThan(10);
    });
  });
});