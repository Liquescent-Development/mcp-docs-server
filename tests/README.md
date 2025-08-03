# Test Suite for MCP Docs Server

This directory contains comprehensive tests for the Electron documentation scraper and related functionality.

## Test Structure

### Unit Tests (`/tests/unit/`)
- **scrapers.test.ts**: Comprehensive unit tests for the ElectronScraper class
  - Initialization and configuration validation
  - HTML parsing with mocked responses
  - Cache key generation
  - Error handling scenarios
  - Security tests (SSRF prevention, input sanitization)
  - Rate limiting and performance tests
  - Version handling and URL validation

- **tools.test.ts**: Tests for documentation tools and test infrastructure
  - Test utilities validation
  - Mock integration tests
  - Error handling verification

### Integration Tests (`/tests/integration/`)
- **electron-scraper.test.ts**: Real Electron documentation scraping tests
  - Tests against actual Electron API documentation (BrowserWindow, WebContents, etc.)
  - Migration guide scraping validation
  - Example extraction verification
  - Content quality and structure validation
  - Error resilience testing
  - Performance and rate limiting verification

- **electron-endpoints.test.ts**: Endpoint verification tests
  - Verifies Electron documentation URLs are accessible
  - Validates response formats and content structure
  - Tests alternative URL patterns and version handling
  - Security header verification
  - Performance and caching validation

- **server.test.ts**: Server integration tests (placeholder for future server tests)

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### With Coverage
```bash
npm run test:coverage
```

## Test Configuration

The test suite uses Vitest with the following configuration:

- **Timeout**: 30 seconds for integration tests (to handle network requests)
- **Environment**: Node.js
- **Coverage**: v8 provider with 70% thresholds
- **Retry**: Integration tests retry up to 2 times for flaky network requests
- **Rate Limiting**: Integration tests include delays to respect Electron docs rate limits

## Test Categories

### 1. Unit Tests (Fast, Isolated)
- Mock all external dependencies
- Test individual components in isolation
- Focus on logic, edge cases, and error handling
- Run quickly without network requests

### 2. Integration Tests (Slower, Real Dependencies)
- Test against real Electron documentation
- Verify actual URL accessibility and content structure
- Test end-to-end scraping workflows
- Include rate limiting and real error scenarios

### 3. Security Tests
- SSRF prevention validation
- Input sanitization verification
- URL validation testing
- Error message security (no sensitive data leakage)

### 4. Performance Tests
- Rate limiting behavior verification
- Large HTML response handling
- Concurrent request management
- Response time validation

## Test Data and Mocks

### Mock Data
- **testUtils.generateMockHTML()**: Creates realistic HTML for testing
- **testUtils.createMockScraperConfig()**: Generates valid scraper configurations
- **Axios mocks**: Control HTTP responses for unit tests

### Real Data
- Integration tests use actual Electron documentation
- Tests verify real URL patterns and content structure
- Rate limiting respects actual Electron server limits

## Best Practices

### Unit Tests
- Use mocks for all external dependencies
- Test both success and failure scenarios
- Verify error messages don't expose sensitive information
- Test edge cases and boundary conditions

### Integration Tests
- Include delays between requests to respect rate limits
- Test against stable, well-known APIs (BrowserWindow, WebContents)
- Verify content quality and structure
- Handle flaky network conditions with retries

### Security Tests
- Test SSRF prevention with private IP ranges
- Verify input sanitization with malicious inputs
- Validate URL construction security
- Check for information disclosure in errors

## Environment Variables

Tests use the following environment variables:

- `NODE_ENV=test`: Indicates test environment
- `LOG_LEVEL=error`: Reduces log noise during tests
- `HTTP_TIMEOUT=15000`: Sets reasonable HTTP timeouts

## Troubleshooting

### Common Issues

1. **Integration test failures**: Often due to network issues or rate limiting
   - Solution: Retry the tests or check network connectivity

2. **Timeout errors**: Long-running integration tests may timeout
   - Solution: Increase timeout in vitest.config.ts

3. **Rate limiting**: Too many requests to Electron docs
   - Solution: Increase delays between requests in integration tests

4. **Mock issues**: Unit tests failing due to incorrect mocks
   - Solution: Verify mock setup in beforeEach hooks

### Debug Mode

To run tests with debug output:
```bash
DEBUG=* npm test
```

To run specific test files:
```bash
npx vitest run tests/unit/scrapers.test.ts
npx vitest run tests/integration/electron-scraper.test.ts
```

## Coverage Requirements

The test suite maintains the following coverage thresholds:
- **Branches**: 70%
- **Functions**: 70% 
- **Lines**: 70%
- **Statements**: 70%

Coverage reports are generated in HTML format and can be viewed after running `npm run test:coverage`.