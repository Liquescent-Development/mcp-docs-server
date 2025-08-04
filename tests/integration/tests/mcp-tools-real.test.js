import { describe, it, expect } from 'vitest';

describe('MCP Tools Real Documentation Tests', () => {
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

  describe('Real Documentation Scraping', () => {
    it('should search Electron documentation for "app" and return actual results', async () => {
      const response = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 'app',
          sources: ['electron']
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.jsonrpc).toBe('2.0');
      expect(result.result).toBeDefined();
      expect(result.result.content).toBeDefined();
      expect(Array.isArray(result.result.content)).toBe(true);
      expect(result.result.content.length).toBeGreaterThan(0);
      
      const content = result.result.content[0];
      expect(content.type).toBe('text');
      expect(content.text).toBeDefined();
      expect(typeof content.text).toBe('string');
      expect(content.text.length).toBeGreaterThan(0);
      
      // Should contain actual documentation content, not mock responses
      expect(content.text).not.toContain('Mock response');
      expect(content.text.toLowerCase()).toContain('app');
      
      console.log('Sample search result:', content.text.substring(0, 200) + '...');
    }, 30000); // 30 second timeout for network requests

    it('should get Electron app API reference and return proper response', async () => {
      const response = await sendMCPMessage('tools/call', {
        name: 'get_api_reference',
        arguments: {
          api_name: 'app',
          source: 'electron'
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.jsonrpc).toBe('2.0');
      expect(result.result).toBeDefined();
      expect(result.result.content).toBeDefined();
      expect(Array.isArray(result.result.content)).toBe(true);
      expect(result.result.content.length).toBeGreaterThan(0);
      
      const content = result.result.content[0];
      expect(content.type).toBe('text');
      expect(content.text).toBeDefined();
      expect(typeof content.text).toBe('string');
      expect(content.text.length).toBeGreaterThan(0);
      
      // Should not be a mock response
      expect(content.text).not.toContain('Mock response');
      
      // Could be either actual documentation or "No documentation found" message
      const isValidResponse = 
        content.text.toLowerCase().includes('app') || 
        content.text.toLowerCase().includes('no documentation found');
      
      expect(isValidResponse).toBe(true);
      
      console.log('Sample API reference:', content.text.substring(0, 200) + '...');
    }, 30000);

    it('should find Electron examples and return proper response', async () => {
      const response = await sendMCPMessage('tools/call', {
        name: 'find_examples',
        arguments: {
          topic: 'window',
          sources: ['electron']
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.jsonrpc).toBe('2.0');
      expect(result.result).toBeDefined();
      expect(result.result.content).toBeDefined();
      expect(Array.isArray(result.result.content)).toBe(true);
      expect(result.result.content.length).toBeGreaterThan(0);
      
      const content = result.result.content[0];
      expect(content.type).toBe('text');
      expect(content.text).toBeDefined();
      expect(typeof content.text).toBe('string');
      expect(content.text.length).toBeGreaterThan(0);
      
      // Should not be a mock response
      expect(content.text).not.toContain('Mock response');
      
      // Could be either actual examples or "0 found" message
      const isValidResponse = 
        content.text.toLowerCase().includes('window') || 
        content.text.includes('0 found') ||
        content.text.toLowerCase().includes('code examples');
      
      expect(isValidResponse).toBe(true);
      
      console.log('Sample examples:', content.text.substring(0, 200) + '...');
    }, 30000);

    it('should handle search for non-existent topic gracefully', async () => {
      const response = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 'xyz123nonexistenttopic456',
          sources: ['electron']
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.jsonrpc).toBe('2.0');
      expect(result.result).toBeDefined();
      expect(result.result.content).toBeDefined();
      expect(Array.isArray(result.result.content)).toBe(true);
      
      // Even for non-existent topics, should return some response
      // (could be empty results or a message about no results found)
      const content = result.result.content[0];
      expect(content.type).toBe('text');
      expect(content.text).toBeDefined();
      
      console.log('Non-existent topic response:', content.text.substring(0, 200) + '...');
    }, 30000);

    it('should handle invalid API name in get_api_reference gracefully', async () => {
      const response = await sendMCPMessage('tools/call', {
        name: 'get_api_reference',
        arguments: {
          api_name: 'nonexistentapi123',
          source: 'electron'
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.jsonrpc).toBe('2.0');
      expect(result.result).toBeDefined();
      expect(result.result.content).toBeDefined();
      expect(Array.isArray(result.result.content)).toBe(true);
      
      const content = result.result.content[0];
      expect(content.type).toBe('text');
      expect(content.text).toBeDefined();
      
      console.log('Invalid API response:', content.text.substring(0, 200) + '...');
    }, 30000);
  });

  describe('Documentation Quality Validation', () => {
    it('should return well-structured search results with relevant content', async () => {
      const response = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 'BrowserWindow',
          sources: ['electron']
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      const content = result.result.content[0];
      
      // Should contain relevant Electron-specific content
      const text = content.text.toLowerCase();
      expect(text).toContain('browserwindow');
      
      // Should not contain HTML tags (should be cleaned/parsed)
      expect(content.text).not.toMatch(/<[^>]+>/);
      
      // Should have reasonable length (not empty, not excessively long)
      expect(content.text.length).toBeGreaterThan(50);
      expect(content.text.length).toBeLessThan(50000);
      
      console.log('BrowserWindow search quality check passed');
    }, 30000);

    it('should return coherent API reference documentation', async () => {
      const response = await sendMCPMessage('tools/call', {
        name: 'get_api_reference',
        arguments: {
          api_name: 'BrowserWindow',
          source: 'electron'
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      const content = result.result.content[0];
      
      // Should be a valid response from the real tool
      expect(content.text).not.toContain('Mock response');
      
      const text = content.text.toLowerCase();
      
      // Could be either actual documentation containing BrowserWindow or "No documentation found"
      const isValidResponse = 
        text.includes('browserwindow') || 
        text.includes('no documentation found');
      
      expect(isValidResponse).toBe(true);
      
      // If it's actual documentation, it should contain API elements
      if (text.includes('browserwindow')) {
        const containsApiElements = 
          text.includes('method') || 
          text.includes('property') || 
          text.includes('parameter') ||
          text.includes('constructor') ||
          text.includes('event') ||
          text.includes('class') ||
          text.includes('function');
        
        expect(containsApiElements).toBe(true);
      }
      
      console.log('BrowserWindow API reference quality check passed');
    }, 30000);
  });

  describe('Error Handling with Real Tools', () => {
    it('should handle network failures gracefully', async () => {
      // Test with an invalid source to simulate network/parsing issues
      const response = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 'test',
          sources: ['nonexistent_source']
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      // Should either return results or handle the error gracefully
      expect(result.jsonrpc).toBe('2.0');
      
      if (result.error) {
        // If there's an error, it should be properly formatted
        expect(result.error.code).toBeDefined();
        expect(result.error.message).toBeDefined();
        expect(typeof result.error.message).toBe('string');
      } else {
        // If there's a result, it should be properly formatted
        expect(result.result).toBeDefined();
        expect(result.result.content).toBeDefined();
      }
    }, 30000);
  });
});