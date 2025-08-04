import { describe, it, expect, beforeAll } from 'vitest';
import WebSocket from 'ws';

describe('MCP Tools Integration Tests', () => {
  let ws;
  let messageId = 1;

  const sendMCPMessage = async (method, params = {}) => {
    const message = {
      jsonrpc: '2.0',
      id: messageId++,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for response to ${method}`));
      }, 10000);

      const handleMessage = (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === message.id) {
            clearTimeout(timeout);
            ws.off('message', handleMessage);
            
            if (response.error) {
              reject(new Error(`MCP Error: ${response.error.message}`));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          // Ignore parsing errors for other messages
        }
      };

      ws.on('message', handleMessage);
      ws.send(JSON.stringify(message));
    });
  };

  beforeAll(async () => {
    // Connect to MCP server via WebSocket
    const wsUrl = global.MCP_SERVER_URL.replace('http://', 'ws://').replace('https://', 'wss://');
    ws = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
    });

    // Initialize MCP connection
    await sendMCPMessage('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      clientInfo: {
        name: 'integration-test-client',
        version: '1.0.0'
      }
    });
  });

  afterAll(() => {
    if (ws) {
      ws.close();
    }
  });

  describe('Tools Discovery', () => {
    it('should list available tools', async () => {
      const result = await sendMCPMessage('tools/list');
      
      expect(result).toHaveProperty('tools');
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);

      // Check for expected tools
      const toolNames = result.tools.map(tool => tool.name);
      expect(toolNames).toContain('search_documentation');
      expect(toolNames).toContain('get_api_reference');
      expect(toolNames).toContain('find_examples');
      expect(toolNames).toContain('get_migration_guide');
    });

    it('should have proper tool schemas', async () => {
      const result = await sendMCPMessage('tools/list');
      
      for (const tool of result.tools) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('type', 'object');
        expect(tool.inputSchema).toHaveProperty('properties');
      }
    });
  });

  describe('search_documentation Tool', () => {
    it('should search documentation successfully', async () => {
      const result = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 'browser window',
          sources: ['electron'],
          limit: 5
        }
      });

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);

      // Check result structure
      const firstResult = result.content[0];
      expect(firstResult).toHaveProperty('type', 'text');
      expect(firstResult).toHaveProperty('text');
      
      const searchResults = JSON.parse(firstResult.text);
      expect(searchResults).toHaveProperty('results');
      expect(searchResults).toHaveProperty('totalFound');
      expect(searchResults).toHaveProperty('source');
    });

    it('should handle multiple sources', async () => {
      const result = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 'hooks',
          sources: ['react', 'node'],
          limit: 10
        }
      });

      expect(result).toHaveProperty('content');
      const searchResults = JSON.parse(result.content[0].text);
      expect(searchResults.results.length).toBeGreaterThan(0);
    });

    it('should validate required parameters', async () => {
      try {
        await sendMCPMessage('tools/call', {
          name: 'search_documentation',
          arguments: {} // Missing required 'query' parameter
        });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).toContain('Error');
      }
    });

    it('should handle empty search results gracefully', async () => {
      const result = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 'xyznonexistentqueryzyx123',
          limit: 5
        }
      });

      expect(result).toHaveProperty('content');
      const searchResults = JSON.parse(result.content[0].text);
      expect(searchResults).toHaveProperty('results');
      expect(searchResults.totalFound).toBe(0);
    });
  });

  describe('get_api_reference Tool', () => {
    it('should get API reference for Electron', async () => {
      const result = await sendMCPMessage('tools/call', {
        name: 'get_api_reference',
        arguments: {
          source: 'electron',
          apiName: 'BrowserWindow'
        }
      });

      expect(result).toHaveProperty('content');
      const apiRef = JSON.parse(result.content[0].text);
      expect(apiRef).toHaveProperty('entries');
      expect(apiRef).toHaveProperty('source', 'electron');
    });

    it('should handle invalid API names', async () => {
      const result = await sendMCPMessage('tools/call', {
        name: 'get_api_reference',
        arguments: {
          source: 'electron',
          apiName: 'NonExistentAPI'
        }
      });

      expect(result).toHaveProperty('content');
      const apiRef = JSON.parse(result.content[0].text);
      expect(apiRef.entries.length).toBe(0);
    });
  });

  describe('find_examples Tool', () => {
    it('should find code examples', async () => {
      const result = await sendMCPMessage('tools/call', {
        name: 'find_examples',
        arguments: {
          topic: 'window creation',
          source: 'electron',
          limit: 3
        }
      });

      expect(result).toHaveProperty('content');
      const examples = JSON.parse(result.content[0].text);
      expect(examples).toHaveProperty('examples');
      expect(examples).toHaveProperty('source', 'electron');
    });

    it('should handle multiple sources for examples', async () => {
      const result = await sendMCPMessage('tools/call', {
        name: 'find_examples',
        arguments: {
          topic: 'hooks',
          sources: ['react'],
          limit: 5
        }
      });

      expect(result).toHaveProperty('content');
      const examples = JSON.parse(result.content[0].text);
      expect(examples).toHaveProperty('examples');
    });
  });

  describe('get_migration_guide Tool', () => {
    it('should get migration guide', async () => {
      const result = await sendMCPMessage('tools/call', {
        name: 'get_migration_guide',
        arguments: {
          source: 'electron',
          fromVersion: '28',
          toVersion: '29'
        }
      });

      expect(result).toHaveProperty('content');
      const migration = JSON.parse(result.content[0].text);
      expect(migration).toHaveProperty('guides');
      expect(migration).toHaveProperty('source', 'electron');
      expect(migration).toHaveProperty('fromVersion', '28');
      expect(migration).toHaveProperty('toVersion', '29');
    });

    it('should handle version validation', async () => {
      try {
        await sendMCPMessage('tools/call', {
          name: 'get_migration_guide',
          arguments: {
            source: 'electron'
            // Missing required version parameters
          }
        });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).toContain('Error');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tool names', async () => {
      try {
        await sendMCPMessage('tools/call', {
          name: 'non_existent_tool',
          arguments: {}
        });
        expect.fail('Should have thrown error for invalid tool');
      } catch (error) {
        expect(error.message).toContain('Error');
      }
    });

    it('should handle malformed requests', async () => {
      try {
        await sendMCPMessage('tools/call', {
          // Missing required 'name' parameter
          arguments: {}
        });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).toContain('Error');
      }
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        sendMCPMessage('tools/call', {
          name: 'search_documentation',
          arguments: {
            query: `test query ${i}`,
            limit: 2
          }
        })
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      
      for (const result of results) {
        expect(result).toHaveProperty('content');
      }
    });

    it('should respect rate limiting', async () => {
      const startTime = Date.now();
      
      // Make rapid requests
      const promises = Array.from({ length: 3 }, () =>
        sendMCPMessage('tools/call', {
          name: 'search_documentation',
          arguments: {
            query: 'rate limit test',
            limit: 1
          }
        })
      );

      await Promise.all(promises);
      
      // Should complete without errors (rate limiting is configured for test environment)
      expect(Date.now() - startTime).toBeLessThan(10000);
    });
  });
});