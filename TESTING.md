# Testing Guide

This document describes the testing strategy and setup for the MCP Documentation Server.

## Test Architecture

The testing suite includes multiple layers:

1. **Unit Tests** - Test individual components and functions
2. **Integration Tests** - Test the complete system via Docker
3. **Performance Tests** - Validate system performance under load
4. **Security Tests** - Verify security measures and error handling

## Integration Test Suite

### Overview

The integration test suite uses Docker Compose to create an isolated test environment that mirrors production. Tests are written using Vitest and run against a live instance of the MCP server.

### Test Categories

#### Health Check Tests (`tests/health.test.js`)
- Server availability and health endpoint
- System information reporting
- Cache status validation
- Scraper status verification
- CORS header validation

#### MCP Tools Tests (`tests/mcp-tools.test.js`)
- WebSocket connection to MCP server
- Tool discovery and schema validation
- All four MCP tools functionality:
  - `search_documentation`
  - `get_api_reference`
  - `find_examples`
  - `get_migration_guide`
- Parameter validation and error handling
- Concurrent request handling

#### Error Handling Tests (`tests/error-handling.test.js`)
- HTTP error responses (404, 405, 400)
- Request validation and malformed JSON
- Security error handling and sanitization
- Resource cleanup and connection drops
- Cache error resilience

#### Performance Tests (`tests/performance.test.js`)
- Response time validation
- Memory usage monitoring
- Concurrent load handling
- Cache performance benefits
- Resource efficiency under sustained load
- Burst request handling

### Running Integration Tests

#### Using Make (Recommended)
```bash
# Run all integration tests
make test-integration

# Run only performance tests
make test-performance

# Quick health check
make quick-test

# CI mode (with optimizations)
make ci
```

#### Using Scripts Directly
```bash
# Full integration test suite
./scripts/run-integration-tests.sh

# With cleanup disabled (for debugging)
./scripts/run-integration-tests.sh --no-cleanup

# Help and options
./scripts/run-integration-tests.sh --help
```

#### Using Docker Compose
```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d mcp-docs-server-test

# Run tests
docker-compose -f docker-compose.test.yml run --rm integration-tests

# Cleanup
docker-compose -f docker-compose.test.yml down --volumes
```

### Test Configuration

#### Test-Specific Settings

The test environment uses optimized settings in `docker-compose.test.yml`:

- **Port**: 3001 (to avoid conflicts with development)
- **Cache**: Memory-only with 60-second TTL
- **Rate Limiting**: 120 requests/minute (higher for testing)
- **Resources**: Limited CPU (1 core) and memory (512MB)
- **Storage**: tmpfs volumes for cache and logs
- **Logging**: Debug level for detailed output

#### Environment Variables

Key test environment variables:

```bash
NODE_ENV=test                               # Test mode
MCP_SERVER_URL=http://mcp-docs-server-test:3000  # Internal Docker URL
CACHE_STORAGE=memory                        # Memory-only cache
LOG_LEVEL=debug                            # Detailed logging
```

### Test Results

#### Output Formats

Tests produce multiple output formats:

1. **Console Output**: Real-time test results with colors
2. **JUnit XML**: `test-results/integration/integration-results.xml`
3. **Coverage Reports**: `test-results/coverage/` (if enabled)
4. **Artifacts**: Uploaded to CI/CD system

#### Interpreting Results

**Successful Test Run:**
```
✅ Health Check Tests (6/6 passed)
✅ MCP Tools Integration Tests (15/15 passed)
✅ Error Handling Tests (12/12 passed)
✅ Performance Tests (8/8 passed)

Total: 41 tests passed
```

**Failed Test Analysis:**
- Check server logs: `docker-compose -f docker-compose.test.yml logs mcp-docs-server-test`
- Review test logs: `docker-compose -f docker-compose.test.yml logs integration-tests`
- Examine test artifacts in `test-results/`

## CI/CD Integration

### GitHub Actions

The project includes comprehensive CI/CD workflows in `.github/workflows/`:

#### Integration Tests Workflow
- Triggers: Push to main/develop, pull requests, daily schedule
- Matrix testing across Node.js versions
- Docker layer caching for performance
- Test result publishing and artifact upload
- Security scanning with Trivy

#### Performance Testing
- Triggered by schedule or `performance` label
- Extended timeout for load testing
- Resource usage monitoring

### Local CI Simulation

```bash
# Simulate CI environment locally
CI=true ./scripts/run-integration-tests.sh

# Or using Make
make ci
```

## Development Workflow

### Test-Driven Development

1. **Write failing test**:
   ```javascript
   it('should handle new feature', async () => {
     const result = await sendMCPMessage('new_tool', { param: 'value' });
     expect(result).toHaveProperty('expectedField');
   });
   ```

2. **Implement feature**: Add functionality to make test pass

3. **Verify with integration tests**:
   ```bash
   make test-integration
   ```

### Debugging Tests

#### Interactive Debugging

1. Start test environment without auto-cleanup:
   ```bash
   ./scripts/run-integration-tests.sh --no-cleanup
   ```

2. Connect to running containers:
   ```bash
   # Server shell
   docker exec -it mcp-docs-server-test /bin/sh
   
   # Test shell
   make shell-test
   ```

3. Run individual tests:
   ```bash
   # Inside test container
   npm run test:integration -- --testNamePattern="Health Check"
   ```

#### Log Analysis

```bash
# Server logs
make logs-test

# Specific log filtering
docker-compose -f docker-compose.test.yml logs mcp-docs-server-test | grep ERROR

# Health check
make health
```

## Performance Benchmarks

### Expected Performance Metrics

#### Response Times
- Health check: < 1 second
- Search requests: < 2 seconds
- Concurrent requests (20): < 10 seconds total

#### Resource Usage
- Memory: < 512MB under normal load
- Memory growth: < 50MB during load tests
- CPU: < 90% under sustained load

#### Throughput
- Concurrent requests: 20+ simultaneous
- Burst handling: 50+ requests
- Success rate: > 70% under burst load

### Performance Test Scenarios

1. **Response Time Test**: Measures individual request latency
2. **Concurrent Load Test**: 20 simultaneous requests
3. **Memory Usage Test**: Monitors memory growth during load
4. **Recovery Test**: Validates recovery after load spikes
5. **Cache Performance**: Measures cache hit benefits
6. **Sustained Load Test**: 5-second continuous load
7. **Burst Test**: 50 rapid requests

## Security Testing

### Security Test Coverage

1. **Input Validation**: SQL injection, XSS, path traversal
2. **Error Handling**: Information disclosure prevention
3. **Rate Limiting**: DoS protection validation
4. **CORS**: Cross-origin request handling
5. **Headers**: Security header validation

### Security Scanning

```bash
# Docker image security scan
make security-scan

# Dependency audit
make audit

# Manual security test
make test-integration -- --testNamePattern="Security"
```

## Troubleshooting

### Common Issues

#### Tests Timeout
- Increase timeout in test configuration
- Check system resources (CPU, memory)
- Verify network connectivity

#### Docker Issues
```bash
# Clean up Docker system
make clean

# Rebuild images
make build-test

# Check Docker resources
docker system df
```

#### Port Conflicts
```bash
# Check port usage
lsof -i :3001

# Kill conflicting processes
pkill -f mcp-docs-server
```

#### Permission Issues
```bash
# Fix test results permissions
sudo chown -R $USER:$GROUP test-results/

# Fix secrets permissions
chmod 600 secrets/github_token.txt
```

### Debug Checklist

1. ✅ Docker daemon running
2. ✅ Port 3001 available
3. ✅ Sufficient disk space (>2GB)
4. ✅ Memory available (>4GB recommended)
5. ✅ Internet connectivity for image pulls
6. ✅ Secrets file exists (`secrets/github_token.txt`)

## Best Practices

### Writing Tests

1. **Use descriptive test names**:
   ```javascript
   it('should return 404 for non-existent API endpoints', async () => {
   ```

2. **Test both success and failure cases**:
   ```javascript
   describe('search_documentation Tool', () => {
     it('should search successfully with valid parameters', async () => {
     it('should handle validation errors gracefully', async () => {
   ```

3. **Use proper assertions**:
   ```javascript
   expect(response.status).toBe(200);
   expect(response.data).toHaveProperty('status', 'healthy');
   ```

4. **Clean up resources**:
   ```javascript
   afterAll(() => {
     if (ws) ws.close();
   });
   ```

### Test Maintenance

1. **Regular Updates**: Keep test dependencies updated
2. **Performance Monitoring**: Track test execution times
3. **Coverage Analysis**: Maintain test coverage metrics
4. **Documentation**: Update test docs with new features

### CI/CD Best Practices

1. **Fast Feedback**: Optimize for quick test execution
2. **Parallel Execution**: Use test matrix for multiple environments
3. **Artifact Collection**: Always collect test results and logs
4. **Failure Analysis**: Provide detailed failure information

## Future Enhancements

### Planned Improvements

1. **Contract Testing**: API contract validation with Pact
2. **Load Testing**: Dedicated load testing with k6 or Artillery
3. **Chaos Engineering**: Fault injection testing
4. **Visual Testing**: Screenshot comparison for UI components
5. **E2E Testing**: Full workflow testing with real MCP clients

### Monitoring Integration

1. **Metrics Collection**: Prometheus/Grafana integration
2. **Alerting**: Test failure notifications
3. **Trend Analysis**: Historical performance tracking
4. **SLA Monitoring**: Service level agreement validation