import crypto from 'crypto';
import { CacheOptions } from '../types.js';

/**
 * Generate a cache key from parameters
 */
export function generateCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      if (params[key] !== undefined && params[key] !== null) {
        acc[key] = params[key];
      }
      return acc;
    }, {} as Record<string, any>);

  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(sortedParams))
    .digest('hex')
    .substring(0, 16);

  return `${prefix}:${hash}`;
}

/**
 * Check if a cache entry is expired
 */
export function isCacheExpired(timestamp: number, ttl: number): boolean {
  return Date.now() - timestamp > ttl * 1000;
}

/**
 * Parse cache TTL from environment variable or return default
 */
export function parseCacheTTL(envVar?: string, defaultTTL: number = 3600): number {
  if (!envVar) return defaultTTL;
  
  const parsed = parseInt(envVar, 10);
  if (isNaN(parsed) || parsed <= 0) {
    return defaultTTL;
  }
  
  return parsed;
}

/**
 * Create cache options from environment variables
 */
export function createCacheOptions(options?: Partial<CacheOptions>): CacheOptions {
  return {
    ttl: parseCacheTTL(process.env.CACHE_TTL, 3600),
    storage: process.env.CACHE_STORAGE as CacheOptions['storage'] || 'both',
    ...options
  };
}

/**
 * Sanitize a string to be used as a filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9_-]/gi, '_')
    .replace(/_+/g, '_')
    .substring(0, 255);
}