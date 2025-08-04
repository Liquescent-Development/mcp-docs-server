# Test Suite for MCP Documentation Server

This directory contains comprehensive tests for the MCP Documentation Server with **54 production-ready integration tests**.

## Test Structure

### Unit Tests (`/tests/unit/`)
- **scrapers.test.ts**: Unit tests for documentation scrapers (Electron, React, Node.js, GitHub)
  - Initialization and configuration validation
  - HTML parsing with mocked responses
  - Cache key generation and error handling
  - Security tests (SSRF prevention, input sanitization)
  - Rate limiting and performance validation

- **tools.test.ts**: Tests for MCP tools (search, API reference, examples, migration)
  - Tool schema validation and parameter handling
  - Mock integration tests and error scenarios

### Integration Tests (`/tests/integration/`) - **54 Tests Total**

**Docker-based integration tests running in isolated containers:**

- **mcp-protocol.test.js** (15 tests) - MCP specification compliance
  - Protocol initialization and handshake validation
  - Tools discovery and schema verification
  - Tool execution with parameter validation
  - JSON-RPC protocol compliance and error handling

- **mcp-http.test.js** (6 tests) - HTTP SSE transport validation
  - SSE connection establishment and session management
  - POST endpoint validation and CORS support
  - HTTP transport error handling

- **mcp-tools-real.test.js** (8 tests) - **Real documentation scraping validation**
  - ✅ **Validates actual content scraping from Electron docs** (not mock responses)
  - API reference retrieval with real content verification
  - Example finding and content structure validation
  - Error handling for non-existent topics and APIs
  - Documentation quality assurance checks

- **security-validation.test.js** (12 tests) - Security and attack prevention
  - XSS prevention and script tag sanitization
  - SQL injection attempt handling
  - Path traversal protection and source validation
  - Request size limits and DoS protection
  - Session isolation and concurrent request handling

- **health.test.js** (5 tests) - System health and monitoring
  - Health endpoint response validation
  - Proper HTTP status codes and headers
  - System availability checks

- **mcp-tools.test.js** (8 tests) - Core MCP tool functionality
  - Tool registration and availability
  - Parameter validation and error handling
  - Response format compliance

## Running Tests

### All Tests (Unit + Integration)
```bash
npm run test:all
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests with Docker
```bash
# Run complete integration test suite (54 tests)
docker-compose -f docker-compose.test.yml up --build

# View test results
cat test-results/integration-results.xml
```

### Development Integration Tests
```bash
# Run integration tests locally (requires server running)
cd tests/integration
npm run test:integration
```

### With Coverage
```bash
npm run test:coverage
```

## Test Configuration

### Docker-based Integration Tests
The integration test suite runs in isolated Docker containers with:

- **Timeout**: 30 seconds for network requests and real documentation scraping
- **Environment**: Node.js 20+ in Alpine Linux containers
- **Isolation**: Each test suite runs in separate containers
- **Real Documentation**: Tests validate actual content from Electron, React, Node.js docs
- **Security Testing**: XSS, injection, DoS protection validation
- **Rate Limiting**: Delays between requests to respect documentation site limits

### Unit Tests (Vitest)
Local unit tests use Vitest with:

- **Environment**: Node.js
- **Coverage**: v8 provider with 70% thresholds
- **Mocking**: All external dependencies mocked for fast execution
- **Retry**: Up to 2 retries for flaky network-dependent tests

## Test Categories

### 1. Unit Tests (Fast, Isolated)
- Mock all external dependencies
- Test individual components in isolation
- Focus on logic, edge cases, and error handling
- Run quickly without network requests

### 2. Integration Tests (Docker-based, Real Dependencies)
- **54 comprehensive tests** validating real documentation scraping
- Test against live Electron, React, Node.js documentation sites
- Verify actual URL accessibility and content structure parsing
- End-to-end MCP protocol compliance testing
- Security validation with real attack scenarios
- Rate limiting and network error handling

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

### Real Data Validation
- **Production-ready testing**: All 54 integration tests use live documentation sources
- **Content verification**: Tests confirm actual documentation scraping (17 results for "app" query)
- **URL pattern validation**: Tests verify modern Docusaurus-based documentation structure
- **Rate limiting compliance**: Respects actual documentation site server limits
- **Error handling**: Real network timeouts and 404 responses tested

## Best Practices

### Unit Tests
- Use mocks for all external dependencies
- Test both success and failure scenarios
- Verify error messages don't expose sensitive information
- Test edge cases and boundary conditions

### Docker Integration Tests
- **Multi-container testing**: Server and tests run in isolated Docker containers
- **Real documentation validation**: Tests confirm actual content scraping from live sources
- **Network resilience**: Handle timeouts, rate limits, and connection failures
- **Content quality assurance**: Verify documentation structure and relevance
- **Security testing**: Real XSS, injection, and DoS attack simulation
- **Cross-platform compatibility**: Tests run consistently across development environments

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
# Unit tests
npx vitest run tests/unit/scrapers.test.ts
npx vitest run tests/unit/tools.test.ts

# Integration tests (requires Docker)
docker-compose -f docker-compose.test.yml up --build

# Single integration test category
cd tests/integration
npm run test:health    # Health check tests only
npm run test:mcp       # MCP protocol tests only
```

## Coverage Requirements

The test suite maintains the following coverage thresholds:
- **Branches**: 70%
- **Functions**: 70% 
- **Lines**: 70%
- **Statements**: 70%

Coverage reports are generated in HTML format and can be viewed after running `npm run test:coverage`.