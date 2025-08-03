import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
// Global test setup
beforeAll(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
    // Set reasonable timeouts for HTTP requests in tests
    process.env.HTTP_TIMEOUT = '15000';
    // Mock external dependencies if needed
    console.log('Setting up test environment...');
});
afterAll(async () => {
    // Cleanup after all tests
    console.log('Cleaning up test environment...');
});
beforeEach(() => {
    // Reset any global state before each test
    // Clear any timers, mocks, etc.
});
afterEach(() => {
    // Cleanup after each test
    // Reset mocks, clear timers, etc.
});
// Global error handler for uncaught exceptions in tests
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});
// Export test utilities that can be used across test files
export const testUtils = {
    // Wait for a specified amount of time
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    // Create a mock scraper config for testing
    createMockScraperConfig: (overrides = {}) => ({
        baseUrl: 'https://www.electronjs.org',
        timeout: 30000,
        rateLimit: 60,
        headers: {
            'User-Agent': 'Test-Agent'
        },
        ...overrides
    }),
    // Generate random test data
    randomString: (length = 10) => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    // Mock HTML generator for testing
    generateMockHTML: (options = {}) => {
        const { title = 'Test Documentation', content = 'Test content for documentation', codeBlocks = [], apiSections = [] } = options;
        let html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body>
          <h1 class="page-title">${title}</h1>
          <div class="markdown-body">
            <p>${content}</p>
    `;
        // Add API sections
        for (const section of apiSections) {
            html += `
        <div class="api-section">
          <h2>${section.title}</h2>
          <div class="markdown-body">
            <p>${section.content}</p>
          </div>
        </div>
      `;
        }
        // Add code blocks
        for (const code of codeBlocks) {
            html += `
        <pre><code class="language-javascript">${code}</code></pre>
      `;
        }
        html += `
          </div>
        </body>
      </html>
    `;
        return html;
    },
    // Validate test environment
    validateTestEnvironment: () => {
        const requiredEnvVars = ['NODE_ENV'];
        const missing = requiredEnvVars.filter(env => !process.env[env]);
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
        if (process.env.NODE_ENV !== 'test') {
            console.warn('Warning: NODE_ENV is not set to "test"');
        }
    }
};
// Validate test environment on setup
testUtils.validateTestEnvironment();
//# sourceMappingURL=setup.js.map