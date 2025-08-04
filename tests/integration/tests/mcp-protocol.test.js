import { describe, it, expect } from 'vitest';

describe('MCP Protocol Integration Tests', () => {
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

  describe('MCP Initialization', () => {
    it('should complete MCP initialize handshake', async () => {
      const response = await sendMCPMessage('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        clientInfo: { name: 'test-client', version: '1.0.0' }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.jsonrpc).toBe('2.0');
      expect(result.id).toBe(1);
      expect(result.result).toBeDefined();
      expect(result.result.protocolVersion).toBe('2025-06-18');
      expect(result.result.capabilities).toBeDefined();
      expect(result.result.serverInfo).toBeDefined();
      expect(result.result.serverInfo.name).toBe('mcp-docs-server');
    });

    it('should validate protocol version compatibility', async () => {
      const response = await sendMCPMessage('initialize', {
        protocolVersion: '1999-01-01', // Invalid old version
        capabilities: { tools: {} },
        clientInfo: { name: 'test-client', version: '1.0.0' }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      // Should either accept or provide error with supported versions
      if (result.error) {
        expect(result.error.code).toBeDefined();
        expect(result.error.message).toBeDefined();
      } else {
        expect(result.result.protocolVersion).toBeDefined();
      }
    });

    it('should handle missing required initialization parameters', async () => {
      const response = await sendMCPMessage('initialize', {
        // Missing required parameters
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      // Should return error for missing parameters
      expect(result.error).toBeDefined();
      expect(result.error.code).toBeDefined();
    });
  });

  describe('Tools Discovery', () => {
    it('should list all available MCP tools', async () => {
      // First initialize
      await sendMCPMessage('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        clientInfo: { name: 'test-client', version: '1.0.0' }
      });

      const response = await sendMCPMessage('tools/list', {});

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.jsonrpc).toBe('2.0');
      expect(result.result).toBeDefined();
      expect(result.result.tools).toBeDefined();
      expect(Array.isArray(result.result.tools)).toBe(true);
      
      // Should have all 4 expected tools
      const toolNames = result.result.tools.map(tool => tool.name);
      expect(toolNames).toContain('search_documentation');
      expect(toolNames).toContain('get_api_reference');
      expect(toolNames).toContain('find_examples');
      expect(toolNames).toContain('get_migration_guide');
      
      // Each tool should have proper schema
      result.result.tools.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
      });
    });

    it('should provide detailed tool schemas', async () => {
      // First initialize
      await sendMCPMessage('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        clientInfo: { name: 'test-client', version: '1.0.0' }
      });

      const response = await sendMCPMessage('tools/list', {});
      const result = await response.json();
      
      const searchTool = result.result.tools.find(tool => tool.name === 'search_documentation');
      expect(searchTool).toBeDefined();
      expect(searchTool.inputSchema.type).toBe('object');
      expect(searchTool.inputSchema.properties).toBeDefined();
      expect(searchTool.inputSchema.properties.query).toBeDefined();
      expect(searchTool.inputSchema.required).toContain('query');
    });
  });

  describe('Tool Execution', () => {
    beforeEach(async () => {
      // Initialize session for each test
      await sendMCPMessage('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        clientInfo: { name: 'test-client', version: '1.0.0' }
      });
    });

    it('should execute search_documentation tool', async () => {
      const response = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 'React hooks',
          sources: ['react']
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.jsonrpc).toBe('2.0');
      expect(result.result).toBeDefined();
      expect(result.result.content).toBeDefined();
      expect(Array.isArray(result.result.content)).toBe(true);
      
      if (result.result.content.length > 0) {
        const content = result.result.content[0];
        expect(content.type).toBe('text');
        expect(content.text).toBeDefined();
        expect(typeof content.text).toBe('string');
      }
    });

    it('should execute get_api_reference tool', async () => {
      const response = await sendMCPMessage('tools/call', {
        name: 'get_api_reference',
        arguments: {
          api_name: 'useState',
          source: 'react'
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.jsonrpc).toBe('2.0');
      
      // Should either return a result or an error, but not undefined
      if (result.result) {
        expect(result.result.content).toBeDefined();
        expect(Array.isArray(result.result.content)).toBe(true);
        expect(result.result.content.length).toBeGreaterThan(0);
        
        // Should not be a mock response
        const content = result.result.content[0];
        expect(content.text).not.toContain('Mock response');
      } else if (result.error) {
        // If there's an error, it should be properly formatted
        expect(result.error.code).toBeDefined();
        expect(result.error.message).toBeDefined();
      } else {
        // Should have either result or error
        throw new Error('Response should have either result or error');
      }
    });

    it('should execute find_examples tool', async () => {
      const response = await sendMCPMessage('tools/call', {
        name: 'find_examples',
        arguments: {
          topic: 'component',
          sources: ['react']
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.jsonrpc).toBe('2.0');
      expect(result.result).toBeDefined();
      expect(result.result.content).toBeDefined();
      expect(Array.isArray(result.result.content)).toBe(true);
    });

    it('should execute get_migration_guide tool', async () => {
      const response = await sendMCPMessage('tools/call', {
        name: 'get_migration_guide',
        arguments: {
          from_version: '17',
          to_version: '18',
          source: 'react'
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.jsonrpc).toBe('2.0');
      expect(result.result).toBeDefined();
      expect(result.result.content).toBeDefined();
      expect(Array.isArray(result.result.content)).toBe(true);
    });

    it('should handle invalid tool names', async () => {
      const response = await sendMCPMessage('tools/call', {
        name: 'nonexistent_tool',
        arguments: {}
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.error).toBeDefined();
      expect(result.error.code).toBeDefined();
      expect(result.error.message).toContain('tool');
    });

    it('should validate required parameters', async () => {
      const response = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          // Missing required 'query' parameter
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.error).toBeDefined();
      expect(result.error.code).toBeDefined();
    });

    it('should handle invalid parameter types', async () => {
      const response = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 123, // Should be string
          sources: 'not-an-array' // Should be array
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.error).toBeDefined();
      expect(result.error.code).toBeDefined();
    });
  });

  describe('JSON-RPC Protocol Compliance', () => {
    it('should handle malformed JSON-RPC requests', async () => {
      const sid = await getSessionId();
      
      const response = await fetch(`${global.MCP_SERVER_URL}/mcp?sessionId=${sid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing required jsonrpc field
          id: 1,
          method: 'initialize'
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32600); // Invalid Request
    });

    it('should handle requests without id field', async () => {
      const sid = await getSessionId();
      
      const response = await fetch(`${global.MCP_SERVER_URL}/mcp?sessionId=${sid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          // Missing id field
          method: 'tools/list'
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      // Should handle notification-style requests or return error
      if (result.error) {
        expect(result.error.code).toBeDefined();
      }
    });

    it('should return proper error codes for method not found', async () => {
      const response = await sendMCPMessage('nonexistent_method', {});

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32601); // Method not found
      expect(result.error.message).toBeDefined();
    });
  });
});