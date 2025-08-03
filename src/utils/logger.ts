import winston from 'winston';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
const logDir = process.env.LOG_DIR || 'logs';

// Create custom format for console output
const consoleFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}] ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

// Create the logger instance
export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
      )
    })
  ]
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));

  logger.add(new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}

// Helper functions for structured logging
export const logScraperActivity = (source: string, action: string, metadata?: any) => {
  logger.info(`Scraper [${source}] ${action}`, { source, action, ...metadata });
};

export const logCacheActivity = (action: string, key: string, metadata?: any) => {
  logger.debug(`Cache ${action}: ${key}`, { action, key, ...metadata });
};

export const logToolActivity = (tool: string, params: any, metadata?: any) => {
  // Sanitize sensitive data from params before logging
  const sanitizedParams = sanitizeLogData(params);
  logger.info(`MCP Tool [${tool}] called`, { tool, params: sanitizedParams, ...metadata });
};

// Helper function to sanitize sensitive data from logs
function sanitizeLogData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const sensitiveKeys = ['token', 'password', 'key', 'secret', 'auth', 'authorization'];
  const sanitized = { ...data };
  
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

export const logError = (error: Error, context?: any) => {
  logger.error(error.message, {
    stack: error.stack,
    name: error.name,
    ...context
  });
};

export default logger;