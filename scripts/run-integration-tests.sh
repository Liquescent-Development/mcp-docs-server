#!/bin/bash
set -e

# Integration Test Runner Script
# This script sets up the test environment and runs integration tests

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_RESULTS_DIR="$PROJECT_DIR/test-results/integration"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

cleanup() {
    log_info "Cleaning up test environment..."
    cd "$PROJECT_DIR"
    docker-compose -f docker-compose.test.yml down --volumes --remove-orphans 2>/dev/null || true
    docker system prune -f --volumes 2>/dev/null || true
}

# Trap cleanup on script exit
trap cleanup EXIT

# Main execution
main() {
    log_info "Starting MCP Documentation Server Integration Tests"
    
    cd "$PROJECT_DIR"
    
    # Ensure we have the latest code
    log_info "Building TypeScript locally first..."
    npm run build || {
        log_error "Failed to build TypeScript. Run 'npm install' first."
        exit 1
    }
    
    log_info "Building latest Docker images..."
    docker-compose -f docker-compose.test.yml build --no-cache
    
    # Create test results directory
    mkdir -p "$TEST_RESULTS_DIR"
    
    # Start test environment
    log_info "Starting test environment..."
    docker-compose -f docker-compose.test.yml up -d mcp-docs-server-test
    
    # Wait for server to be healthy
    log_info "Waiting for server to be ready..."
    timeout=300 # 5 minutes
    elapsed=0
    interval=5
    
    while [ $elapsed -lt $timeout ]; do
        if docker-compose -f docker-compose.test.yml exec -T mcp-docs-server-test curl -f http://localhost:3000/health >/dev/null 2>&1; then
            log_success "Server is ready!"
            break
        fi
        
        sleep $interval
        elapsed=$((elapsed + interval))
        log_info "Waiting... (${elapsed}s/${timeout}s)"
    done
    
    if [ $elapsed -ge $timeout ]; then
        log_error "Server failed to start within timeout"
        docker-compose -f docker-compose.test.yml logs mcp-docs-server-test
        exit 1
    fi
    
    # Run integration tests
    log_info "Running integration tests..."
    
    if docker-compose -f docker-compose.test.yml run --rm integration-tests; then
        log_success "Integration tests passed!"
        
        # Copy test results
        log_info "Copying test results..."
        docker cp integration-tests:/app/test-results/. "$TEST_RESULTS_DIR/" 2>/dev/null || log_warning "Could not copy test results"
        
        exit 0
    else
        log_error "Integration tests failed!"
        
        # Show logs for debugging
        log_info "Server logs:"
        docker-compose -f docker-compose.test.yml logs mcp-docs-server-test
        
        log_info "Test logs:"
        docker-compose -f docker-compose.test.yml logs integration-tests
        
        # Copy test results even on failure
        docker cp integration-tests:/app/test-results/. "$TEST_RESULTS_DIR/" 2>/dev/null || log_warning "Could not copy test results"
        
        exit 1
    fi
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --cleanup-only Only run cleanup without testing"
        echo "  --no-cleanup   Skip cleanup after tests"
        echo ""
        echo "Environment Variables:"
        echo "  CI             Set to 'true' for CI environment optimizations"
        echo "  DOCKER_BUILDKIT Set to '1' to enable Docker BuildKit"
        exit 0
        ;;
    --cleanup-only)
        cleanup
        exit 0
        ;;
    --no-cleanup)
        trap - EXIT
        ;;
esac

# Set CI optimizations
if [ "$CI" = "true" ]; then
    log_info "CI environment detected, applying optimizations..."
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
fi

# Run main function
main "$@"