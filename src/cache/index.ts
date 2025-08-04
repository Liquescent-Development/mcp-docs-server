import NodeCache from 'node-cache';
import { CacheEntry, CacheOptions, CacheError } from '../types.js';
import { FileStorage } from './storage.js';
import { isCacheExpired } from '../utils/cache.js';
import { logCacheActivity, logError } from '../utils/logger.js';

export class DocumentationCache {
  private memoryCache: NodeCache;
  private fileStorage: FileStorage | null;
  private defaultTTL: number;

  constructor(options: CacheOptions & { cacheDir?: string }) {
    this.defaultTTL = options.ttl || 3600;
    
    // Initialize memory cache
    this.memoryCache = new NodeCache({
      stdTTL: this.defaultTTL,
      checkperiod: 600, // Check for expired keys every 10 minutes
      useClones: false // Don't clone objects for performance
    });

    // Initialize file storage if enabled
    if (options.storage === 'file' || options.storage === 'both') {
      if (!options.cacheDir) {
        throw new Error('cacheDir is required when using file storage');
      }
      this.fileStorage = new FileStorage(options.cacheDir);
    } else {
      this.fileStorage = null;
    }

    // Set up periodic cleanup for file storage
    if (this.fileStorage) {
      setInterval(() => {
        this.fileStorage?.cleanup(this.defaultTTL).catch(error => {
          logError(error, { context: 'periodic cache cleanup' });
        });
      }, 3600000); // Run cleanup every hour
    }
  }

  async get<T>(key: string): Promise<T | null> {
    // Try memory cache first
    const memoryResult = this.memoryCache.get<CacheEntry<T>>(key);
    
    if (memoryResult) {
      if (!isCacheExpired(memoryResult.timestamp, memoryResult.ttl)) {
        logCacheActivity('memory hit', key);
        return memoryResult.data;
      } else {
        // Remove expired entry
        this.memoryCache.del(key);
      }
    }

    // Try file storage if available
    if (this.fileStorage) {
      try {
        const fileResult = await this.fileStorage.get<T>(key);
        
        if (fileResult && !isCacheExpired(fileResult.timestamp, fileResult.ttl)) {
          // Restore to memory cache
          this.memoryCache.set(key, fileResult, fileResult.ttl);
          logCacheActivity('file hit', key);
          return fileResult.data;
        } else if (fileResult) {
          // Remove expired entry
          await this.fileStorage.delete(key);
        }
      } catch (error) {
        logError(error as Error, { context: 'cache get', key });
      }
    }

    logCacheActivity('miss', key);
    return null;
  }

  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const actualTTL = ttl || this.defaultTTL;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: actualTTL
    };

    // Store in memory cache
    this.memoryCache.set(key, entry, actualTTL);
    logCacheActivity('memory set', key, { ttl: actualTTL });

    // Store in file storage if available
    if (this.fileStorage) {
      try {
        await this.fileStorage.set(key, entry);
        logCacheActivity('file set', key, { ttl: actualTTL });
      } catch (error) {
        logError(error as Error, { context: 'cache set', key });
      }
    }
  }

  async delete(key: string): Promise<void> {
    // Delete from memory cache
    this.memoryCache.del(key);
    logCacheActivity('memory delete', key);

    // Delete from file storage if available
    if (this.fileStorage) {
      try {
        await this.fileStorage.delete(key);
        logCacheActivity('file delete', key);
      } catch (error) {
        logError(error as Error, { context: 'cache delete', key });
      }
    }
  }

  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.flushAll();
    logCacheActivity('memory clear', 'all');

    // Clear file storage if available
    if (this.fileStorage) {
      try {
        await this.fileStorage.clear();
        logCacheActivity('file clear', 'all');
      } catch (error) {
        logError(error as Error, { context: 'cache clear' });
      }
    }
  }

  getStats(): { memoryKeys: number; hits: number; misses: number } {
    const stats = this.memoryCache.getStats();
    return {
      memoryKeys: this.memoryCache.keys().length,
      hits: stats.hits,
      misses: stats.misses
    };
  }
}

export { FileStorage } from './storage.js';