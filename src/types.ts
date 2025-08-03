import { z } from 'zod';

// Documentation types
export interface DocumentationEntry {
  title: string;
  content: string;
  url: string;
  type: 'api' | 'guide' | 'example' | 'migration';
  source: 'electron' | 'react' | 'node' | 'github';
  lastUpdated: Date;
  metadata?: Record<string, any>;
}

export interface SearchResult {
  entries: DocumentationEntry[];
  totalCount: number;
  query: string;
  sources: string[];
}

// Scraper types
export interface ScraperConfig {
  baseUrl: string;
  rateLimit?: number;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface ScraperResult {
  entries: DocumentationEntry[];
  source: string;
  scrapedAt: Date;
  errors?: string[];
}

// Cache types
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheOptions {
  ttl?: number;
  storage?: 'memory' | 'file' | 'both';
}

// MCP Tool schemas
export const SearchDocumentationSchema = z.object({
  query: z.string().min(1).describe('Search query string'),
  sources: z.array(z.enum(['electron', 'react', 'node', 'github'])).optional()
    .describe('Specific sources to search (defaults to all)'),
  type: z.enum(['api', 'guide', 'example', 'migration']).optional()
    .describe('Filter by documentation type'),
  limit: z.number().min(1).max(100).default(10)
    .describe('Maximum number of results to return')
});

export const GetApiReferenceSchema = z.object({
  apiName: z.string().min(1).describe('API name or method to look up'),
  source: z.enum(['electron', 'react', 'node', 'github'])
    .describe('Documentation source'),
  version: z.string().optional().describe('Specific version (defaults to latest)')
});

export const FindExamplesSchema = z.object({
  topic: z.string().min(1).describe('Topic or API to find examples for'),
  sources: z.array(z.enum(['electron', 'react', 'node', 'github'])).optional()
    .describe('Specific sources to search'),
  language: z.enum(['javascript', 'typescript', 'jsx', 'tsx']).optional()
    .describe('Filter by code language'),
  limit: z.number().min(1).max(50).default(5)
    .describe('Maximum number of examples to return')
});

export const GetMigrationGuideSchema = z.object({
  source: z.enum(['electron', 'react', 'node', 'github'])
    .describe('Documentation source'),
  fromVersion: z.string().describe('Starting version'),
  toVersion: z.string().describe('Target version')
});

// Type inference from schemas
export type SearchDocumentationParams = z.infer<typeof SearchDocumentationSchema>;
export type GetApiReferenceParams = z.infer<typeof GetApiReferenceSchema>;
export type FindExamplesParams = z.infer<typeof FindExamplesSchema>;
export type GetMigrationGuideParams = z.infer<typeof GetMigrationGuideSchema>;

// Server configuration
export interface ServerConfig {
  port: number;
  cacheDir: string;
  cacheTTL: number;
  rateLimitPerMinute: number;
  sources: {
    electron?: string;
    react?: string;
    node?: string;
    github?: string;
  };
  github?: {
    token?: string;
  };
}

// Error types
export class ScraperError extends Error {
  constructor(
    message: string,
    public source: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ScraperError';
  }
}

export class CacheError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'CacheError';
  }
}