import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ServerResponse } from 'http';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode
} from '@modelcontextprotocol/sdk/types.js';
import { DocumentationCache } from './cache/index.js';
import { SearchTool, DocumentationTool, ExamplesTool, MigrationTool } from './tools/index.js';
import { ServerConfig, ScraperConfig } from './types.js';
import { logger } from './utils/logger.js';
import { createCacheOptions } from './utils/cache.js';

export class MCPDocsServer {
  private server: Server;
  private cache: DocumentationCache;
  private searchTool: SearchTool;
  private docTool: DocumentationTool;
  private examplesTool: ExamplesTool;
  private migrationTool: MigrationTool;

  constructor(config: ServerConfig) {
    // Initialize server
    this.server = new Server(
      {
        name: 'mcp-docs-server',
        version: '1.0.0',
        capabilities: {
          tools: {}
        }
      }
    );

    // Initialize cache
    this.cache = new DocumentationCache({
      ...createCacheOptions(),
      cacheDir: config.cacheDir
    });

    // Create scraper configurations
    const scraperConfigs: Record<string, ScraperConfig> = {};
    
    if (config.sources.electron) {
      scraperConfigs.electron = {
        baseUrl: config.sources.electron,
        rateLimit: config.rateLimitPerMinute
      };
    }
    
    if (config.sources.react) {
      scraperConfigs.react = {
        baseUrl: config.sources.react,
        rateLimit: config.rateLimitPerMinute
      };
    }
    
    if (config.sources.node) {
      scraperConfigs.node = {
        baseUrl: config.sources.node,
        rateLimit: config.rateLimitPerMinute
      };
    }
    
    if (config.sources.github) {
      scraperConfigs.github = {
        baseUrl: config.sources.github,
        rateLimit: config.rateLimitPerMinute,
        headers: config.github?.token 
          ? { Authorization: `token ${config.github.token}` }
          : undefined
      };
    }

    // Initialize tools
    this.searchTool = new SearchTool(this.cache, scraperConfigs);
    this.docTool = new DocumentationTool(this.cache, scraperConfigs);
    this.examplesTool = new ExamplesTool(this.cache, scraperConfigs);
    this.migrationTool = new MigrationTool(this.cache, scraperConfigs);

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Handle list tools request
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_documentation',
            description: 'Search across multiple documentation sources for specific topics',
            inputSchema: this.searchTool.getSchema()
          },
          {
            name: 'get_api_reference',
            description: 'Get detailed API reference documentation for a specific method or class',
            inputSchema: this.docTool.getSchema()
          },
          {
            name: 'find_examples',
            description: 'Find code examples for specific topics or APIs',
            inputSchema: this.examplesTool.getSchema()
          },
          {
            name: 'get_migration_guide',
            description: 'Get migration guides between different versions',
            inputSchema: this.migrationTool.getSchema()
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_documentation': {
            const params = this.searchTool.getSchema().parse(args);
            this.validateSearchParams(params);
            const result = await this.searchTool.search(params);
            return {
              content: [
                {
                  type: 'text',
                  text: this.formatSearchResult(result)
                }
              ]
            };
          }

          case 'get_api_reference': {
            const params = this.docTool.getSchema().parse(args);
            const result = await this.docTool.getApiReference(params);
            
            if (!result) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `No API reference found for "${params.apiName}" in ${params.source}`
                  }
                ]
              };
            }
            
            return {
              content: [
                {
                  type: 'text',
                  text: this.formatDocumentationEntry(result)
                }
              ]
            };
          }

          case 'find_examples': {
            const params = this.examplesTool.getSchema().parse(args);
            const results = await this.examplesTool.findExamples(params);
            
            if (results.length === 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `No examples found for "${params.topic}"`
                  }
                ]
              };
            }
            
            return {
              content: [
                {
                  type: 'text',
                  text: this.formatExamples(results)
                }
              ]
            };
          }

          case 'get_migration_guide': {
            const params = this.migrationTool.getSchema().parse(args);
            const results = await this.migrationTool.getMigrationGuide(params);
            
            if (results.length === 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `No migration guide found for ${params.source} from ${params.fromVersion} to ${params.toVersion}`
                  }
                ]
              };
            }
            
            return {
              content: [
                {
                  type: 'text',
                  text: this.formatMigrationGuide(results, params)
                }
              ]
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        
        logger.error('Tool execution error', { tool: name, error });
        
        // Don't expose internal error details to clients
        const userMessage = this.isUserFacingError(error) 
          ? (error instanceof Error ? error.message : String(error))
          : `Tool ${name} encountered an error. Please try again later.`;
          
        throw new McpError(
          ErrorCode.InternalError,
          userMessage
        );
      }
    });
  }

  /**
   * Determine if an error should be shown to users or hidden for security
   */
  private isUserFacingError(error: any): boolean {
    if (error instanceof McpError) return true;
    
    // Only show validation errors and known safe errors
    const safeErrorTypes = ['ValidationError', 'ScraperError'];
    const errorName = error?.constructor?.name || error?.name;
    
    return safeErrorTypes.includes(errorName);
  }

  /**
   * Validate search parameters for security
   */
  private validateSearchParams(params: any): void {
    // Prevent excessively long queries that could cause DoS
    if (params.query?.length > 1000) {
      throw new Error('Search query too long');
    }
    
    // Sanitize query for potential injection attempts
    if (params.query?.includes('<script>') || params.query?.includes('javascript:')) {
      throw new Error('Invalid characters in search query');
    }
  }

  private formatSearchResult(result: any): string {
    let output = `# Search Results for "${result.query}"\n\n`;
    output += `Found ${result.totalCount} results across ${result.sources.join(', ')}\n\n`;

    result.entries.forEach((entry: any, index: number) => {
      output += `## ${index + 1}. ${entry.title}\n`;
      output += `**Source:** ${entry.source} | **Type:** ${entry.type}\n`;
      output += `**URL:** ${entry.url}\n\n`;
      
      // Truncate content for search results
      const preview = entry.content.substring(0, 300);
      output += `${preview}${entry.content.length > 300 ? '...' : ''}\n\n`;
      output += '---\n\n';
    });

    return output;
  }

  private formatDocumentationEntry(entry: any): string {
    let output = `# ${entry.title}\n\n`;
    output += `**Source:** ${entry.source} | **Type:** ${entry.type}\n`;
    output += `**URL:** ${entry.url}\n`;
    output += `**Last Updated:** ${new Date(entry.lastUpdated).toISOString()}\n\n`;
    output += `## Content\n\n${entry.content}\n`;
    
    if (entry.metadata) {
      output += `\n## Metadata\n\`\`\`json\n${JSON.stringify(entry.metadata, null, 2)}\n\`\`\`\n`;
    }
    
    return output;
  }

  private formatExamples(examples: any[]): string {
    let output = `# Code Examples (${examples.length} found)\n\n`;

    examples.forEach((example, index) => {
      output += `## Example ${index + 1}: ${example.title}\n`;
      output += `**Source:** ${example.source}\n`;
      output += `**URL:** ${example.url}\n`;
      
      if (example.metadata?.language) {
        output += `**Language:** ${example.metadata.language}\n`;
      }
      
      output += `\n\`\`\`${example.metadata?.language || ''}\n${example.content}\n\`\`\`\n\n`;
      output += '---\n\n';
    });

    return output;
  }

  private formatMigrationGuide(entries: any[], params: any): string {
    let output = `# Migration Guide: ${params.source} ${params.fromVersion} � ${params.toVersion}\n\n`;

    entries.forEach((entry, index) => {
      if (index > 0) output += '\n---\n\n';
      
      output += `## ${entry.title}\n\n`;
      output += entry.content + '\n';
      
      if (entry.metadata) {
        output += `\n### Additional Information\n`;
        output += `- From Version: ${entry.metadata.fromVersion || params.fromVersion}\n`;
        output += `- To Version: ${entry.metadata.toVersion || params.toVersion}\n`;
      }
    });

    return output;
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('MCP Documentation Server started with stdio transport');
  }

  /**
   * Start the server with HTTP SSE transport
   * @param res - HTTP ServerResponse for SSE connection
   * @param endpoint - The endpoint path for POST messages
   * @returns The SSE transport instance for handling HTTP requests
   */
  async startHttp(res: ServerResponse, endpoint: string = '/mcp'): Promise<SSEServerTransport> {
    const transport = new SSEServerTransport(endpoint, res);
    await this.server.connect(transport);
    logger.info('MCP Documentation Server started with HTTP SSE transport');
    return transport;
  }

  async stop(): Promise<void> {
    await this.cache.clear();
    logger.info('MCP Documentation Server stopped');
  }

  // Public methods to access tools for HTTP JSON-RPC handler
  async executeSearchTool(params: any): Promise<any> {
    const result = await this.searchTool.search(params);
    return {
      content: [
        {
          type: 'text',
          text: this.formatSearchResult(result)
        }
      ]
    };
  }

  async executeDocumentationTool(params: any): Promise<any> {
    const result = await this.docTool.getApiReference(params);
    return {
      content: [
        {
          type: 'text',
          text: result ? this.formatDocumentationEntry(result) : 'No documentation found for the specified API.'
        }
      ]
    };
  }

  async executeExamplesTool(params: any): Promise<any> {
    const results = await this.examplesTool.findExamples(params);
    return {
      content: [
        {
          type: 'text',
          text: this.formatExamples(results)
        }
      ]
    };
  }

  async executeMigrationTool(params: any): Promise<any> {
    const results = await this.migrationTool.getMigrationGuide(params);
    return {
      content: [
        {
          type: 'text',
          text: this.formatMigrationGuide(results, params)
        }
      ]
    };
  }
}