import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    setupFiles: ['./setup.js'],
    include: ['./tests/**/*.test.js'],
    exclude: ['node_modules/**', 'dist/**'],
    reporters: ['verbose', 'junit'],
    outputFile: {
      junit: '/app/test-results/integration-results.xml'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: '/app/test-results/coverage'
    }
  }
});