import fs from 'fs/promises';
import path from 'path';
import { CacheEntry, CacheError } from '../types.js';
import { sanitizeFilename } from '../utils/cache.js';
import { logCacheActivity, logError } from '../utils/logger.js';

export class FileStorage {
  private cacheDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    this.ensureCacheDirectory();
  }

  private async ensureCacheDirectory(): Promise<void> {
    try {
      // Validate cache directory path for security
      this.validateCacheDirectory();
      
      await fs.mkdir(this.cacheDir, { 
        recursive: true,
        mode: 0o700 // Restrict permissions to owner only
      });
    } catch (error) {
      throw new CacheError('Failed to create cache directory', error as Error);
    }
  }

  /**
   * Validate cache directory path for security
   */
  private validateCacheDirectory(): void {
    const normalizedPath = path.resolve(this.cacheDir);
    
    // Prevent directory traversal attacks
    if (normalizedPath.includes('..') || normalizedPath.includes('~')) {
      throw new Error('Invalid cache directory path - directory traversal detected');
    }
    
    // Ensure path is within reasonable bounds (not system directories)
    const systemDirs = ['/etc', '/usr', '/var', '/bin', '/sbin', '/boot', '/dev', '/proc', '/sys'];
    if (systemDirs.some(dir => normalizedPath.startsWith(dir))) {
      throw new Error('Cache directory cannot be in system directories');
    }
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const filename = this.getFilename(key);
    const filepath = path.join(this.cacheDir, filename);

    try {
      const data = await fs.readFile(filepath, 'utf-8');
      const entry = JSON.parse(data) as CacheEntry<T>;
      
      logCacheActivity('file read', key, { filepath });
      return entry;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        logCacheActivity('file miss', key, { filepath });
        return null;
      }
      
      const cacheError = new CacheError(`Failed to read cache file: ${key}`, error as Error);
      logError(cacheError, { key, filepath });
      throw cacheError;
    }
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const filename = this.getFilename(key);
    const filepath = path.join(this.cacheDir, filename);

    try {
      const data = JSON.stringify(entry, null, 2);
      await fs.writeFile(filepath, data, 'utf-8');
      
      logCacheActivity('file write', key, { filepath, size: data.length });
    } catch (error) {
      const cacheError = new CacheError(`Failed to write cache file: ${key}`, error as Error);
      logError(cacheError, { key, filepath });
      throw cacheError;
    }
  }

  async delete(key: string): Promise<void> {
    const filename = this.getFilename(key);
    const filepath = path.join(this.cacheDir, filename);

    try {
      await fs.unlink(filepath);
      logCacheActivity('file delete', key, { filepath });
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        const cacheError = new CacheError(`Failed to delete cache file: ${key}`, error as Error);
        logError(cacheError, { key, filepath });
        throw cacheError;
      }
    }
  }

  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      
      await Promise.all(
        files.map(file => 
          fs.unlink(path.join(this.cacheDir, file)).catch(() => {})
        )
      );
      
      logCacheActivity('file clear', 'all', { count: files.length });
    } catch (error) {
      const cacheError = new CacheError('Failed to clear cache directory', error as Error);
      logError(cacheError, { cacheDir: this.cacheDir });
      throw cacheError;
    }
  }

  async cleanup(ttl: number): Promise<number> {
    let cleanedCount = 0;
    
    try {
      const files = await fs.readdir(this.cacheDir);
      const now = Date.now();
      
      for (const file of files) {
        const filepath = path.join(this.cacheDir, file);
        
        try {
          const data = await fs.readFile(filepath, 'utf-8');
          const entry = JSON.parse(data) as CacheEntry;
          
          if (now - entry.timestamp > ttl * 1000) {
            await fs.unlink(filepath);
            cleanedCount++;
          }
        } catch (error) {
          // Skip invalid files
        }
      }
      
      logCacheActivity('file cleanup', 'expired', { cleanedCount });
      return cleanedCount;
    } catch (error) {
      const cacheError = new CacheError('Failed to cleanup cache', error as Error);
      logError(cacheError, { cacheDir: this.cacheDir });
      throw cacheError;
    }
  }

  private getFilename(key: string): string {
    // Additional validation beyond sanitizeFilename
    if (!key || key.length === 0) {
      throw new Error('Cache key cannot be empty');
    }
    
    if (key.length > 200) {
      throw new Error('Cache key too long');
    }
    
    const sanitized = sanitizeFilename(key);
    
    // Ensure we don't create hidden files or special files
    if (sanitized.startsWith('.') || sanitized.includes('..')) {
      throw new Error('Invalid cache key format');
    }
    
    return `${sanitized}.json`;
  }
}