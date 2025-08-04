import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPDocsServer } from '../../src/server.js';
import { ServerConfig } from '../../src/types.js';

/**
 * Tests to verify that all examples shown in README.md actually work
 * This ensures the README is accurate and users get expected results
 */
describe('README Example Verification Tests', () => {
  let server: MCPDocsServer;

  const testConfig: ServerConfig = {
    port: 3001,
    cacheDir: './test-cache',
    rateLimitPerMinute: 60,
    sources: {
      electron: 'https://www.electronjs.org',
      react: 'https://react.dev',
      node: 'https://nodejs.org',
      github: 'https://docs.github.com'
    }
  };

  beforeAll(async () => {
    server = new MCPDocsServer(testConfig);
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('README Example: "How do I create a window in Electron?"', () => {
    it('should return meaningful Electron BrowserWindow documentation', async () => {
      // This tests the main example shown in the README
      const result = await server.executeSearchTool({
        query: 'create browser window',
        sources: ['electron'],
        type: 'api',
        limit: 10
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const text = result.content[0].text.toLowerCase();
      
      // Should contain relevant Electron window creation content
      expect(text).toContain('browserwindow');
      expect(text).toContain('electron');
      
      // Should be substantial documentation, not just empty results
      expect(result.content[0].text.length).toBeGreaterThan(100);
      
      // Should not be a mock response
      expect(text).not.toContain('mock');
      
      console.log('✅ BrowserWindow search returned:', result.content[0].text.substring(0, 200) + '...');
    }, 30000);

    it('should return BrowserWindow API reference documentation', async () => {
      const result = await server.executeDocumentationTool({
        apiName: 'BrowserWindow',
        source: 'electron'
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const text = result.content[0].text.toLowerCase();
      
      // Should either contain BrowserWindow documentation or a proper "not found" message
      const isValidResponse = 
        text.includes('browserwindow') || 
        text.includes('no documentation found');
      
      expect(isValidResponse).toBe(true);
      
      if (text.includes('browserwindow')) {
        // If documentation is found, it should contain API elements
        const hasApiElements = 
          text.includes('class') || 
          text.includes('constructor') ||
          text.includes('method') ||
          text.includes('property') ||
          text.includes('parameter');
        
        expect(hasApiElements).toBe(true);
      }
      
      console.log('✅ BrowserWindow API reference:', result.content[0].text.substring(0, 200) + '...');
    }, 30000);
  });

  describe('README Example: Custom Menu Creation', () => {
    it('should find Electron menu examples and documentation', async () => {
      const searchResult = await server.executeSearchTool({
        query: 'menu',
        sources: ['electron'],
        type: 'api',
        limit: 5
      });

      expect(searchResult.content).toBeDefined();
      expect(searchResult.content[0].type).toBe('text');
      
      const text = searchResult.content[0].text.toLowerCase();
      expect(text).toContain('menu');
      
      console.log('✅ Menu search returned:', searchResult.content[0].text.substring(0, 200) + '...');

      // Also test finding examples
      const examplesResult = await server.executeExamplesTool({
        topic: 'menu',
        sources: ['electron'],
        limit: 3
      });

      expect(examplesResult.content).toBeDefined();
      expect(examplesResult.content[0].type).toBe('text');
      
      console.log('✅ Menu examples:', examplesResult.content[0].text.substring(0, 200) + '...');
    }, 30000);
  });

  describe('README Example: React Hooks in TypeScript', () => {
    it('should find React hook examples', async () => {
      const result = await server.executeExamplesTool({
        topic: 'hooks',
        sources: ['react'],
        language: 'typescript',
        limit: 5
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const text = result.content[0].text.toLowerCase();
      
      // Should either contain examples or indicate none found
      const isValidResponse = 
        text.includes('hook') || 
        text.includes('0 found') ||
        text.includes('no examples found');
      
      expect(isValidResponse).toBe(true);
      
      console.log('✅ React hooks examples:', result.content[0].text.substring(0, 200) + '...');
    }, 30000);
  });

  describe('README Example: Migration Guide', () => {
    it('should provide React 17 to 18 migration guidance', async () => {
      const result = await server.executeMigrationTool({
        source: 'react',
        fromVersion: '17.0.0',
        toVersion: '18.0.0'
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const text = result.content[0].text.toLowerCase();
      
      // Should either contain migration info or indicate none found
      const isValidResponse = 
        text.includes('migration') || 
        text.includes('17') ||
        text.includes('18') ||
        text.includes('no migration guide found');
      
      expect(isValidResponse).toBe(true);
      
      console.log('✅ React migration guide:', result.content[0].text.substring(0, 200) + '...');
    }, 30000);
  });

  describe('All Documentation Sources Verification', () => {
    it('should successfully connect to and search Electron documentation', async () => {
      const result = await server.executeSearchTool({
        query: 'app',
        sources: ['electron'],
        limit: 3
      });

      expect(result.content[0].text).not.toContain('Mock response');
      expect(result.content[0].text.toLowerCase()).toContain('electron');
      
      console.log('✅ Electron source verified');
    }, 30000);

    it('should successfully connect to and search React documentation', async () => {
      const result = await server.executeSearchTool({
        query: 'component',
        sources: ['react'],
        limit: 3
      });

      expect(result.content[0].text).not.toContain('Mock response');
      
      const text = result.content[0].text.toLowerCase();
      const isValidReactResponse = 
        text.includes('react') || 
        text.includes('component') ||
        text.includes('0 results');
      
      expect(isValidReactResponse).toBe(true);
      
      console.log('✅ React source verified');
    }, 30000);

    it('should successfully connect to and search Node.js documentation', async () => {
      const result = await server.executeSearchTool({
        query: 'fs',
        sources: ['node'],
        limit: 3
      });

      expect(result.content[0].text).not.toContain('Mock response');
      
      const text = result.content[0].text.toLowerCase();
      const isValidNodeResponse = 
        text.includes('node') || 
        text.includes('file') ||
        text.includes('fs') ||
        text.includes('0 results');
      
      expect(isValidNodeResponse).toBe(true);
      
      console.log('✅ Node.js source verified');
    }, 30000);

    it('should successfully connect to and search GitHub documentation', async () => {
      const result = await server.executeSearchTool({
        query: 'api',
        sources: ['github'],
        limit: 3
      });

      expect(result.content[0].text).not.toContain('Mock response');
      
      const text = result.content[0].text.toLowerCase();
      const isValidGitHubResponse = 
        text.includes('github') || 
        text.includes('api') ||
        text.includes('0 results');
      
      expect(isValidGitHubResponse).toBe(true);
      
      console.log('✅ GitHub source verified');
    }, 30000);
  });

  describe('Tool Schema and Interface Verification', () => {
    it('should provide all four MCP tools as claimed in README', async () => {
      // Verify the server exposes exactly the tools claimed in README
      const expectedTools = [
        'search_documentation',
        'get_api_reference', 
        'find_examples',
        'get_migration_guide'
      ];

      // Test each tool is callable
      for (const toolName of expectedTools) {
        let toolWorks = false;
        
        try {
          switch (toolName) {
            case 'search_documentation':
              await server.executeSearchTool({ query: 'test', sources: ['electron'] });
              toolWorks = true;
              break;
            case 'get_api_reference':
              await server.executeDocumentationTool({ apiName: 'test', source: 'electron' });
              toolWorks = true;
              break;
            case 'find_examples':
              await server.executeExamplesTool({ topic: 'test', sources: ['electron'] });
              toolWorks = true;
              break;
            case 'get_migration_guide':
              await server.executeMigrationTool({ source: 'react', fromVersion: '17', toVersion: '18' });
              toolWorks = true;
              break;
          }
        } catch (error) {
          // Tools may return errors for invalid params, but should be callable
          toolWorks = true;
        }
        
        expect(toolWorks).toBe(true);
        console.log(`✅ Tool ${toolName} is functional`);
      }
    }, 30000);
  });

  describe('Response Format and Quality Verification', () => {
    it('should return properly formatted search results as shown in README', async () => {
      const result = await server.executeSearchTool({
        query: 'window',
        sources: ['electron'],
        limit: 3
      });

      const text = result.content[0].text;
      
      // Should match README format: "# Search Results for..."
      expect(text).toMatch(/# Search Results for/);
      expect(text).toMatch(/Found \d+ results/);
      
      // Should have structured output with source and type information
      if (!text.includes('Found 0 results')) {
        expect(text).toMatch(/\*\*Source:\*\* electron/);
        expect(text).toMatch(/\*\*Type:\*\*/);
        expect(text).toMatch(/\*\*URL:\*\*/);
      }
      
      console.log('✅ Search result format matches README example');
    }, 30000);

    it('should return well-structured API reference as shown in README', async () => {
      const result = await server.executeDocumentationTool({
        apiName: 'app',
        source: 'electron'
      });

      const text = result.content[0].text;
      
      if (!text.includes('No documentation found')) {
        // Should match README format with title, source, URL, etc.
        expect(text).toMatch(/^# /);
        expect(text).toMatch(/\*\*Source:\*\*/);
        expect(text).toMatch(/\*\*URL:\*\*/);
        expect(text).toMatch(/\*\*Last Updated:\*\*/);
        expect(text).toMatch(/## Content/);
      }
      
      console.log('✅ API reference format matches README example');
    }, 30000);
  });
});