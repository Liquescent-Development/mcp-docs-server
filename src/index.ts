import dotenv from 'dotenv';
import http from 'http';
import fs from 'fs';
import { MCPDocsServer } from './server.js';
import { ServerConfig } from './types.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

// Helper function to load secrets from Docker secrets or environment
function loadSecret(envVar: string, secretPath?: string): string | undefined {
  // Try Docker secrets first
  if (secretPath) {
    try {
      return fs.readFileSync(secretPath, 'utf8').trim();
    } catch (error) {
      // Secret file not found, continue to env var
    }
  }
  
  // Fallback to environment variable
  return process.env[envVar];
}

// Build server configuration from environment
const config: ServerConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  cacheDir: process.env.CACHE_DIR || './cache',
  cacheTTL: parseInt(process.env.CACHE_TTL || '3600', 10),
  rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '60', 10),
  sources: {
    electron: process.env.DOCS_ELECTRON_URL,
    react: process.env.DOCS_REACT_URL,
    node: process.env.DOCS_NODE_URL,
    github: process.env.DOCS_GITHUB_URL
  },
  github: {
    token: loadSecret('GITHUB_TOKEN', '/run/secrets/github_token')
  }
};

// Validate configuration
function validateConfig(config: ServerConfig): void {
  const errors: string[] = [];

  if (!config.cacheDir) {
    errors.push('CACHE_DIR is required');
  }

  const sources = Object.entries(config.sources).filter(([_, url]) => url);
  if (sources.length === 0) {
    errors.push('At least one documentation source URL must be configured');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}

// Main function
async function main(): Promise<void> {
  try {
    logger.info('Starting MCP Documentation Server...');
    logger.info('Configuration:', {
      port: config.port,
      cacheDir: config.cacheDir,
      cacheTTL: config.cacheTTL,
      sources: Object.keys(config.sources).filter(key => config.sources[key as keyof typeof config.sources])
    });

    // Validate configuration
    validateConfig(config);

    // Create and start MCP server
    const mcpServer = new MCPDocsServer(config);
    await mcpServer.start();

    // Create HTTP server that supports both health checks and MCP SSE transport
    const activeTransports = new Map<string, any>(); // sessionId -> transport
    
    const httpServer = http.createServer(async (req, res) => {
      // Enable CORS for integration testing
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = new URL(req.url!, `http://${req.headers.host}`);
      
      // Health check endpoint
      if (url.pathname === '/health' && (req.method === 'GET' || req.method === 'HEAD')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (req.method === 'HEAD') {
          res.end();
        } else {
          res.end(JSON.stringify({ 
            status: 'healthy',
            service: 'mcp-docs-server',
            timestamp: new Date().toISOString()
          }));
        }
        return;
      }
      
      // MCP SSE endpoint - establish SSE connection
      if (url.pathname === '/mcp' && req.method === 'GET') {
        try {
          const transport = await mcpServer.startHttp(res, '/mcp');
          activeTransports.set(transport.sessionId, transport);
          
          // Clean up transport when connection closes
          transport.onclose = () => {
            activeTransports.delete(transport.sessionId);
            logger.info(`MCP SSE connection closed for session ${transport.sessionId}`);
          };
          
          logger.info(`MCP SSE connection established for session ${transport.sessionId}`);
        } catch (error) {
          logger.error('Failed to establish MCP SSE connection', error);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Failed to establish MCP connection');
        }
        return;
      }
      
      // MCP POST endpoint - handle JSON-RPC messages
      if (url.pathname === '/mcp' && req.method === 'POST') {
        const sessionId = url.searchParams.get('sessionId');
        if (!sessionId) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing sessionId parameter');
          return;
        }
        
        const transport = activeTransports.get(sessionId);
        if (!transport) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Session not found');
          return;
        }
        
        try {
          // Read the JSON-RPC request body
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          
          req.on('end', async () => {
            try {
              const jsonRpcRequest = JSON.parse(body);
              logger.info('Processing JSON-RPC request', { method: jsonRpcRequest.method, id: jsonRpcRequest.id });
              
              // Validate JSON-RPC structure
              if (!jsonRpcRequest.jsonrpc || jsonRpcRequest.jsonrpc !== '2.0') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  jsonrpc: '2.0',
                  id: jsonRpcRequest.id || null,
                  error: {
                    code: -32600,
                    message: 'Invalid Request'
                  }
                }));
                return;
              }

              // Handle JSON-RPC methods directly
              let result: any;
              
              if (jsonRpcRequest.method === 'initialize') {
                // Validate initialize parameters
                if (!jsonRpcRequest.params || !jsonRpcRequest.params.protocolVersion) {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    jsonrpc: '2.0',
                    id: jsonRpcRequest.id,
                    error: {
                      code: -32602,
                      message: 'Invalid params: missing required fields'
                    }
                  }));
                  return;
                }
                
                result = {
                  protocolVersion: '2025-06-18',
                  capabilities: { tools: {} },
                  serverInfo: {
                    name: 'mcp-docs-server',
                    version: '1.0.0'
                  }
                };
              } else if (jsonRpcRequest.method === 'tools/list') {
                // Get tools list
                result = {
                  tools: [
                    {
                      name: 'search_documentation',
                      description: 'Search across multiple documentation sources for specific topics',
                      inputSchema: {
                        type: 'object',
                        properties: {
                          query: { type: 'string', description: 'Search query' },
                          sources: { type: 'array', items: { type: 'string' }, description: 'Documentation sources to search' }
                        },
                        required: ['query']
                      }
                    },
                    {
                      name: 'get_api_reference',
                      description: 'Get detailed API reference documentation for a specific method or class',
                      inputSchema: {
                        type: 'object',
                        properties: {
                          api_name: { type: 'string', description: 'Name of the API to get reference for' },
                          source: { type: 'string', description: 'Documentation source' }
                        },
                        required: ['api_name', 'source']
                      }
                    },
                    {
                      name: 'find_examples',
                      description: 'Find code examples for specific topics or APIs',
                      inputSchema: {
                        type: 'object',
                        properties: {
                          topic: { type: 'string', description: 'Topic to find examples for' },
                          sources: { type: 'array', items: { type: 'string' }, description: 'Documentation sources to search' }
                        },
                        required: ['topic']
                      }
                    },
                    {
                      name: 'get_migration_guide',
                      description: 'Get migration guides between different versions',
                      inputSchema: {
                        type: 'object',
                        properties: {
                          from_version: { type: 'string', description: 'Source version' },
                          to_version: { type: 'string', description: 'Target version' },
                          source: { type: 'string', description: 'Documentation source' }
                        },
                        required: ['from_version', 'to_version', 'source']
                      }
                    }
                  ]
                };
              } else if (jsonRpcRequest.method === 'tools/call') {
                // Handle tool calls with validation
                if (!jsonRpcRequest.params || !jsonRpcRequest.params.name) {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    jsonrpc: '2.0',
                    id: jsonRpcRequest.id,
                    error: {
                      code: -32602,
                      message: 'Invalid params: missing tool name'
                    }
                  }));
                  return;
                }
                
                const { name, arguments: args } = jsonRpcRequest.params;
                
                // Validate tool name
                const validTools = ['search_documentation', 'get_api_reference', 'find_examples', 'get_migration_guide'];
                if (!validTools.includes(name)) {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    jsonrpc: '2.0',
                    id: jsonRpcRequest.id,
                    error: {
                      code: -32602,
                      message: `Unknown tool: ${name}`
                    }
                  }));
                  return;
                }
                
                // Basic parameter validation
                if (name === 'search_documentation') {
                  if (!args || !args.query || typeof args.query !== 'string') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                      jsonrpc: '2.0',
                      id: jsonRpcRequest.id,
                      error: {
                        code: -32602,
                        message: 'Invalid params: query must be a string'
                      }
                    }));
                    return;
                  }
                  
                  // Sanitize query (remove potentially dangerous content)
                  const sanitizedQuery = args.query
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[sanitized]')
                    .replace(/javascript:/gi, '[sanitized]')
                    .replace(/on\w+\s*=/gi, '[sanitized]');
                  
                  // Sanitize sources parameter to prevent path traversal
                  let sanitizedSources = args.sources || ['electron', 'react', 'node', 'github'];
                  if (Array.isArray(sanitizedSources)) {
                    sanitizedSources = sanitizedSources.filter(source => 
                      typeof source === 'string' && 
                      /^[a-zA-Z0-9_-]+$/.test(source) &&
                      ['electron', 'react', 'node', 'github'].includes(source)
                    );
                  }
                  
                  // Call the actual search tool
                  try {
                    result = await mcpServer.executeSearchTool({
                      query: sanitizedQuery,
                      sources: sanitizedSources
                    });
                  } catch (toolError) {
                    logger.error('Search tool execution error', toolError);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                      jsonrpc: '2.0',
                      id: jsonRpcRequest.id,
                      error: {
                        code: -32603,
                        message: 'Internal error executing search tool'
                      }
                    }));
                    return;
                  }
                } else if (name === 'get_api_reference') {
                  if (!args || !args.api_name || !args.source) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                      jsonrpc: '2.0',
                      id: jsonRpcRequest.id,
                      error: {
                        code: -32602,
                        message: 'Invalid params: api_name and source are required'
                      }
                    }));
                    return;
                  }
                  
                  try {
                    result = await mcpServer.executeDocumentationTool({
                      apiName: args.api_name,
                      source: args.source
                    });
                  } catch (toolError) {
                    logger.error('API reference tool execution error', toolError);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                      jsonrpc: '2.0',
                      id: jsonRpcRequest.id,
                      error: {
                        code: -32603,
                        message: 'Internal error executing API reference tool'
                      }
                    }));
                    return;
                  }
                } else if (name === 'find_examples') {
                  if (!args || !args.topic) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                      jsonrpc: '2.0',
                      id: jsonRpcRequest.id,
                      error: {
                        code: -32602,
                        message: 'Invalid params: topic is required'
                      }
                    }));
                    return;
                  }
                  
                  // Sanitize sources parameter to prevent path traversal
                  let sanitizedSources = args.sources || ['electron', 'react', 'node', 'github'];
                  if (Array.isArray(sanitizedSources)) {
                    sanitizedSources = sanitizedSources.filter(source => 
                      typeof source === 'string' && 
                      /^[a-zA-Z0-9_-]+$/.test(source) &&
                      ['electron', 'react', 'node', 'github'].includes(source)
                    );
                  }
                  
                  try {
                    result = await mcpServer.executeExamplesTool({
                      topic: args.topic,
                      sources: sanitizedSources
                    });
                  } catch (toolError) {
                    logger.error('Examples tool execution error', toolError);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                      jsonrpc: '2.0',
                      id: jsonRpcRequest.id,
                      error: {
                        code: -32603,
                        message: 'Internal error executing examples tool'
                      }
                    }));
                    return;
                  }
                } else if (name === 'get_migration_guide') {
                  if (!args || !args.from_version || !args.to_version || !args.source) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                      jsonrpc: '2.0',
                      id: jsonRpcRequest.id,
                      error: {
                        code: -32602,
                        message: 'Invalid params: from_version, to_version, and source are required'
                      }
                    }));
                    return;
                  }
                  
                  try {
                    result = await mcpServer.executeMigrationTool({
                      from_version: args.from_version,
                      to_version: args.to_version,
                      source: args.source
                    });
                  } catch (toolError) {
                    logger.error('Migration tool execution error', toolError);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                      jsonrpc: '2.0',
                      id: jsonRpcRequest.id,
                      error: {
                        code: -32603,
                        message: 'Internal error executing migration tool'
                      }
                    }));
                    return;
                  }
                } else {
                  // Unknown tool (shouldn't reach here due to earlier validation)
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    jsonrpc: '2.0',
                    id: jsonRpcRequest.id,
                    error: {
                      code: -32602,
                      message: `Unknown tool: ${name}`
                    }
                  }));
                  return;
                }
              } else {
                // Unknown method
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  jsonrpc: '2.0',
                  id: jsonRpcRequest.id,
                  error: {
                    code: -32601,
                    message: 'Method not found'
                  }
                }));
                return;
              }
              
              // Send successful response
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                jsonrpc: '2.0',
                id: jsonRpcRequest.id,
                result
              }));
              
            } catch (parseError) {
              logger.error('JSON-RPC parse error', parseError);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                jsonrpc: '2.0',
                id: null,
                error: {
                  code: -32700,
                  message: 'Parse error'
                }
              }));
            }
          });
          
        } catch (error) {
          logger.error('Failed to handle MCP POST message', error);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Failed to handle message');
        }
        return;
      }
      
      // 404 for unknown endpoints
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    // Start HTTP server (health + MCP)
    httpServer.listen(config.port, () => {
      logger.info(`HTTP server (health + MCP) listening on port ${config.port}`);
    });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down server...');
      httpServer.close();
      // Close all active MCP transports
      for (const transport of activeTransports.values()) {
        await transport.close();
      }
      await mcpServer.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down server...');
      httpServer.close();
      // Close all active MCP transports
      for (const transport of activeTransports.values()) {
        await transport.close();
      }
      await mcpServer.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

// Start the server
main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});