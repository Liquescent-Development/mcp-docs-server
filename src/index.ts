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

    // Create simple HTTP health check server
    const healthServer = http.createServer((req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'healthy',
          service: 'mcp-docs-server',
          timestamp: new Date().toISOString()
        }));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    // Start health check server
    healthServer.listen(config.port, () => {
      logger.info(`Health check server listening on port ${config.port}`);
    });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down server...');
      healthServer.close();
      await mcpServer.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down server...');
      healthServer.close();
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