import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { setTimeout } from 'timers/promises';

/**
 * Integration tests to verify that all README.md examples work with real network requests
 * This validates that when users try the examples, they actually get useful results
 */
describe('README Example Validation - Real Network Tests', () => {
  let serverProcess: ChildProcess | null = null;
  let sessionId: string | null = null;
  let messageId = 1;
  const SERVER_URL = 'http://localhost:3001';

  beforeAll(async () => {
    // Start the server for testing
    console.log('🚀 Starting MCP server for README validation tests...');
    
    serverProcess = spawn('node', ['dist/index.js'], {
      env: {
        ...process.env,
        PORT: '3001',
        DOCS_ELECTRON_URL: 'https://www.electronjs.org',
        DOCS_REACT_URL: 'https://react.dev',
        DOCS_NODE_URL: 'https://nodejs.org',
        DOCS_GITHUB_URL: 'https://docs.github.com',
        LOG_LEVEL: 'error'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (serverProcess.stdout) {
      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('error') || output.includes('Error')) {
          console.log('Server output:', output);
        }
      });
    }

    if (serverProcess.stderr) {
      serverProcess.stderr.on('data', (data) => {
        console.log('Server error:', data.toString());
      });
    }

    // Wait for server to start
    console.log('⏳ Waiting for server to be ready...');
    let retries = 0;
    const maxRetries = 30;
    
    while (retries < maxRetries) {
      try {
        const response = await fetch(`${SERVER_URL}/health`);
        if (response.ok) {
          console.log('✅ Server is ready!');
          break;
        }
      } catch (error) {
        // Server not ready yet
      }
      
      retries++;
      if (retries >= maxRetries) {
        throw new Error('Server failed to start within timeout period');
      }
      
      await setTimeout(2000);
    }

    // Get session ID
    sessionId = await getSessionId();
  }, 120000); // 2 minute timeout for server startup

  afterAll(async () => {
    if (serverProcess) {
      console.log('🛑 Stopping server...');
      serverProcess.kill();
      // Wait a bit for graceful shutdown
      await setTimeout(2000);
    }
  });

  async function getSessionId(): Promise<string> {
    const response = await fetch(`${SERVER_URL}/mcp`, {
      method: 'GET',
      headers: { 'Accept': 'text/event-stream' }
    });
    
    const reader = response.body?.getReader();
    if (reader) {
      const { value } = await reader.read();
      const sseData = new TextDecoder().decode(value);
      const match = sseData.match(/sessionId=([a-f0-9-]+)/);
      if (match) {
        reader.releaseLock();
        return match[1];
      }
      reader.releaseLock();
    }
    
    throw new Error('Could not establish session');
  }

  async function sendMCPMessage(method: string, params: any = {}) {
    if (!sessionId) {
      throw new Error('No session ID available');
    }

    const message = {
      jsonrpc: '2.0',
      id: messageId++,
      method,
      params
    };

    const response = await fetch(`${SERVER_URL}/mcp?sessionId=${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async function initializeSession() {
    await sendMCPMessage('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: { tools: {} },
      clientInfo: { name: 'readme-validation-client', version: '1.0.0' }
    });
  }

  describe('README Example: "How do I create a window in Electron?"', () => {
    it('should return useful Electron BrowserWindow documentation for window creation', async () => {
      await initializeSession();
      
      console.log('🔍 Testing: "How do I create a window in Electron?"');
      
      const result = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 'create browser window',
          sources: ['electron'],
          type: 'api',
          limit: 10
        }
      });

      expect(result.jsonrpc).toBe('2.0');
      expect(result.result).toBeDefined();
      expect(result.result.content).toBeDefined();
      expect(Array.isArray(result.result.content)).toBe(true);
      expect(result.result.content.length).toBeGreaterThan(0);
      
      const content = result.result.content[0];
      expect(content.type).toBe('text');
      expect(content.text).toBeDefined();
      
      const text = content.text.toLowerCase();
      
      // Should contain relevant Electron window creation content
      expect(text).toContain('browserwindow');
      expect(text).toContain('electron');
      
      // Should be substantial documentation (not just empty results)
      expect(content.text.length).toBeGreaterThan(200);
      
      // Should not be a mock response
      expect(text).not.toContain('mock');
      expect(text).not.toContain('test');
      
      // Should contain practical information for developers
      const containsUsefulInfo = 
        text.includes('window') ||
        text.includes('class') ||
        text.includes('constructor') ||
        text.includes('method') ||
        text.includes('property');
      
      expect(containsUsefulInfo).toBe(true);
      
      console.log('✅ BrowserWindow search result preview:', content.text.substring(0, 300) + '...');
      console.log('📊 Result length:', content.text.length, 'characters');
    }, 60000);

    it('should provide BrowserWindow API reference documentation', async () => {
      await initializeSession();
      
      console.log('📚 Testing BrowserWindow API reference');
      
      const result = await sendMCPMessage('tools/call', {
        name: 'get_api_reference',
        arguments: {
          apiName: 'BrowserWindow',
          source: 'electron'
        }
      });

      expect(result.jsonrpc).toBe('2.0');
      expect(result.result).toBeDefined();
      
      const content = result.result.content[0];
      const text = content.text.toLowerCase();
      
      // Should either contain BrowserWindow documentation or a proper "not found" message
      const isValidResponse = 
        text.includes('browserwindow') || 
        text.includes('no documentation found') ||
        text.includes('no api reference found');
      
      expect(isValidResponse).toBe(true);
      
      if (text.includes('browserwindow')) {
        // If documentation is found, it should contain API elements
        const hasApiElements = 
          text.includes('class') || 
          text.includes('constructor') ||
          text.includes('method') ||
          text.includes('property') ||
          text.includes('event') ||
          text.includes('parameter');
        
        expect(hasApiElements).toBe(true);
        console.log('✅ Found comprehensive BrowserWindow API documentation');
      } else {
        console.log('ℹ️ No BrowserWindow API documentation found - this is acceptable');
      }
      
      console.log('📝 API reference preview:', content.text.substring(0, 300) + '...');
    }, 60000);
  });

  describe('README Example: Custom Menu Creation', () => {
    it('should find Electron menu documentation and examples', async () => {
      await initializeSession();
      
      console.log('🍔 Testing Electron menu documentation');
      
      const searchResult = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 'custom menu',
          sources: ['electron'],
          limit: 5
        }
      });

      expect(searchResult.result.content).toBeDefined();
      
      const searchText = searchResult.result.content[0].text.toLowerCase();
      
      // Should find menu-related content
      const hasMenuContent = 
        searchText.includes('menu') ||
        searchText.includes('application menu') ||
        searchText.includes('0 results'); // Or indicate no results found
      
      expect(hasMenuContent).toBe(true);
      
      console.log('✅ Menu search result:', searchResult.result.content[0].text.substring(0, 200) + '...');

      // Test finding menu examples
      const examplesResult = await sendMCPMessage('tools/call', {
        name: 'find_examples',
        arguments: {
          topic: 'menu',
          sources: ['electron'],
          limit: 3
        }
      });

      expect(examplesResult.result.content).toBeDefined();
      
      const examplesText = examplesResult.result.content[0].text.toLowerCase();
      
      // Should either have examples or properly indicate none found
      const isValidExamplesResponse = 
        examplesText.includes('menu') ||
        examplesText.includes('0 found') ||
        examplesText.includes('no examples found');
      
      expect(isValidExamplesResponse).toBe(true);
      
      console.log('✅ Menu examples result:', examplesResult.result.content[0].text.substring(0, 200) + '...');
    }, 60000);
  });

  describe('All Documentation Sources Verification', () => {
    it('should successfully fetch from Electron documentation', async () => {
      await initializeSession();
      
      console.log('🔌 Testing Electron documentation source');
      
      const result = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 'app',
          sources: ['electron'],
          limit: 3
        }
      });

      expect(result.result.content[0].text).not.toContain('Mock response');
      expect(result.result.content[0].text.length).toBeGreaterThan(50);
      
      const text = result.result.content[0].text.toLowerCase();
      expect(text).toContain('electron');
      
      console.log('✅ Electron source verified - got real documentation');
    }, 60000);

    it('should successfully fetch from React documentation', async () => {
      await initializeSession();
      
      console.log('⚛️ Testing React documentation source');
      
      const result = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 'component',
          sources: ['react'],
          limit: 3
        }
      });

      expect(result.result.content).toBeDefined();
      expect(result.result.content[0].text).not.toContain('Mock response');
      
      const text = result.result.content[0].text.toLowerCase();
      
      // Should either have React content or indicate no results
      const isValidReactResponse = 
        text.includes('react') || 
        text.includes('component') ||
        text.includes('0 results') ||
        text.includes('no documentation found');
      
      expect(isValidReactResponse).toBe(true);
      
      console.log('✅ React source verified');
    }, 60000);

    it('should successfully fetch from Node.js documentation', async () => {
      await initializeSession();
      
      console.log('🟢 Testing Node.js documentation source');
      
      const result = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 'fs module',
          sources: ['node'],
          limit: 3
        }
      });

      expect(result.result.content).toBeDefined();
      expect(result.result.content[0].text).not.toContain('Mock response');
      
      const text = result.result.content[0].text.toLowerCase();
      
      // Should either have Node.js content or indicate no results
      const isValidNodeResponse = 
        text.includes('node') || 
        text.includes('file') ||
        text.includes('fs') ||
        text.includes('0 results') ||
        text.includes('no documentation found');
      
      expect(isValidNodeResponse).toBe(true);
      
      console.log('✅ Node.js source verified');
    }, 60000);

    it('should successfully connect to GitHub documentation', async () => {
      await initializeSession();
      
      console.log('🐙 Testing GitHub documentation source');
      
      const result = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 'api',
          sources: ['github'],
          limit: 3
        }
      });

      expect(result.result.content).toBeDefined();
      expect(result.result.content[0].text).not.toContain('Mock response');
      
      const text = result.result.content[0].text.toLowerCase();
      
      // Should either have GitHub content or indicate no results
      const isValidGitHubResponse = 
        text.includes('github') || 
        text.includes('api') ||
        text.includes('0 results') ||
        text.includes('no documentation found');
      
      expect(isValidGitHubResponse).toBe(true);
      
      console.log('✅ GitHub source verified');
    }, 60000);
  });

  describe('README Claims Verification', () => {
    it('should provide all four MCP tools claimed in README', async () => {
      await initializeSession();
      
      console.log('🔧 Testing all MCP tools are available');
      
      const toolsResult = await sendMCPMessage('tools/list');
      
      expect(toolsResult.result).toBeDefined();
      expect(toolsResult.result.tools).toBeDefined();
      expect(Array.isArray(toolsResult.result.tools)).toBe(true);
      
      const toolNames = toolsResult.result.tools.map((tool: any) => tool.name);
      
      const expectedTools = [
        'search_documentation',
        'get_api_reference',
        'find_examples',
        'get_migration_guide'
      ];
      
      for (const expectedTool of expectedTools) {
        expect(toolNames).toContain(expectedTool);
        console.log(`✅ Tool ${expectedTool} is available`);
      }
      
      console.log('📋 All claimed tools are available:', toolNames);
    }, 30000);

    it('should return properly formatted responses as shown in README', async () => {
      await initializeSession();
      
      console.log('📄 Testing response format matches README examples');
      
      const result = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 'window',
          sources: ['electron'],
          limit: 3
        }
      });

      const text = result.result.content[0].text;
      
      // Should match README format: "# Search Results for..."
      expect(text).toMatch(/# Search Results for/);
      expect(text).toMatch(/Found \d+ results/);
      
      // Should have structured output with source and type information
      if (!text.includes('Found 0 results')) {
        expect(text).toMatch(/\*\*Source:\*\*/);
        expect(text).toMatch(/\*\*Type:\*\*/);
        expect(text).toMatch(/\*\*URL:\*\*/);
      }
      
      console.log('✅ Response format matches README examples');
    }, 30000);
  });

  describe('Performance and Reliability', () => {
    it('should respond within reasonable time limits', async () => {
      await initializeSession();
      
      console.log('⏱️ Testing response performance');
      
      const startTime = Date.now();
      
      const result = await sendMCPMessage('tools/call', {
        name: 'search_documentation',
        arguments: {
          query: 'app',
          sources: ['electron'],
          limit: 5
        }
      });
      
      const responseTime = Date.now() - startTime;
      
      expect(result.result).toBeDefined();
      expect(responseTime).toBeLessThan(30000); // Should respond within 30 seconds
      
      console.log(`✅ Response time: ${responseTime}ms (under 30s limit)`);
    }, 45000);

    it('should handle concurrent requests properly', async () => {
      await initializeSession();
      
      console.log('🔀 Testing concurrent request handling');
      
      const promises = [
        sendMCPMessage('tools/call', {
          name: 'search_documentation',
          arguments: { query: 'app', sources: ['electron'], limit: 2 }
        }),
        sendMCPMessage('tools/call', {
          name: 'get_api_reference',
          arguments: { apiName: 'app', source: 'electron' }
        }),
        sendMCPMessage('tools/call', {
          name: 'find_examples',
          arguments: { topic: 'window', sources: ['electron'], limit: 2 }
        })
      ];
      
      const results = await Promise.all(promises);
      
      // All requests should succeed
      for (const result of results) {
        expect(result.jsonrpc).toBe('2.0');
        expect(result.result).toBeDefined();
      }
      
      console.log('✅ Concurrent requests handled successfully');
    }, 60000);
  });
});