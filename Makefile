# MCP Documentation Server - Development Makefile

.DEFAULT_GOAL := help
.PHONY: help build test test-unit test-integration clean dev prod logs health

# Configuration
COMPOSE_FILE = docker-compose.yml
TEST_COMPOSE_FILE = docker-compose.test.yml
PROJECT_NAME = mcp-docs-server

# Colors for output
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m # No Color

help: ## Show this help message
	@echo "$(GREEN)MCP Documentation Server - Available Commands$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(YELLOW)Examples:$(NC)"
	@echo "  make dev                    # Start development environment"
	@echo "  make test-integration       # Run integration tests"
	@echo "  make logs                   # View service logs"
	@echo "  make clean                  # Clean up everything"

# Development Commands
dev: ## Start development environment
	@echo "$(GREEN)Starting development environment...$(NC)"
	@mkdir -p secrets cache logs
	@if [ ! -f secrets/github_token.txt ]; then \
		echo "dummy-dev-token" > secrets/github_token.txt; \
		chmod 600 secrets/github_token.txt; \
		echo "$(YELLOW)Created dummy GitHub token. Replace with real token for GitHub integration.$(NC)"; \
	fi
	@if [ ! -f docker.env ]; then \
		cp docker.env.example docker.env; \
		echo "$(YELLOW)Created docker.env from example. Update as needed.$(NC)"; \
	fi
	docker-compose -f $(COMPOSE_FILE) up -d
	@echo "$(GREEN)Development environment started!$(NC)"
	@echo "Server: http://localhost:3000"
	@echo "Health: http://localhost:3000/health"

prod: ## Start production environment
	@echo "$(GREEN)Starting production environment...$(NC)"
	@if [ ! -f secrets/github_token.txt ]; then \
		echo "$(RED)Error: secrets/github_token.txt not found. Create it first.$(NC)"; \
		exit 1; \
	fi
	@if [ ! -f docker.env ]; then \
		echo "$(RED)Error: docker.env not found. Copy from docker.env.example and configure.$(NC)"; \
		exit 1; \
	fi
	docker-compose -f $(COMPOSE_FILE) up -d --build
	@echo "$(GREEN)Production environment started!$(NC)"

stop: ## Stop all services
	@echo "$(YELLOW)Stopping services...$(NC)"
	docker-compose -f $(COMPOSE_FILE) down
	docker-compose -f $(TEST_COMPOSE_FILE) down

restart: stop dev ## Restart development environment

# Build Commands
build: ## Build Docker images
	@echo "$(GREEN)Building Docker images...$(NC)"
	docker-compose -f $(COMPOSE_FILE) build --no-cache

build-test: ## Build test Docker images
	@echo "$(GREEN)Building test Docker images...$(NC)"
	docker-compose -f $(TEST_COMPOSE_FILE) build --no-cache

# Test Commands
test: test-unit test-integration ## Run all tests

test-unit: ## Run unit tests
	@echo "$(GREEN)Running unit tests...$(NC)"
	npm test

test-integration: ## Run integration tests
	@echo "$(GREEN)Running integration tests...$(NC)"
	@./scripts/run-integration-tests.sh

test-integration-ci: ## Run integration tests in CI mode
	@echo "$(GREEN)Running integration tests (CI mode)...$(NC)"
	@CI=true ./scripts/run-integration-tests.sh

test-performance: ## Run performance tests only
	@echo "$(GREEN)Running performance tests...$(NC)"
	@mkdir -p secrets
	@echo "dummy-test-token" > secrets/github_token.txt && chmod 600 secrets/github_token.txt
	docker-compose -f $(TEST_COMPOSE_FILE) up -d mcp-docs-server-test
	@timeout 180 bash -c 'until docker-compose -f $(TEST_COMPOSE_FILE) exec -T mcp-docs-server-test curl -f http://localhost:3000/health; do sleep 5; done'
	docker-compose -f $(TEST_COMPOSE_FILE) run --rm integration-tests npm run test:integration -- --testNamePattern="Performance"
	docker-compose -f $(TEST_COMPOSE_FILE) down

# Monitoring Commands
logs: ## View service logs
	docker-compose -f $(COMPOSE_FILE) logs -f

logs-test: ## View test service logs
	docker-compose -f $(TEST_COMPOSE_FILE) logs -f

health: ## Check service health
	@echo "$(GREEN)Checking service health...$(NC)"
	@curl -s http://localhost:3000/health | jq . || echo "$(RED)Service not available or jq not installed$(NC)"

status: ## Show service status
	@echo "$(GREEN)Service Status:$(NC)"
	@docker-compose -f $(COMPOSE_FILE) ps

# Maintenance Commands
clean: ## Clean up containers, volumes, and images
	@echo "$(YELLOW)Cleaning up...$(NC)"
	docker-compose -f $(COMPOSE_FILE) down --volumes --remove-orphans
	docker-compose -f $(TEST_COMPOSE_FILE) down --volumes --remove-orphans
	docker system prune -f --volumes
	@echo "$(GREEN)Cleanup complete!$(NC)"

clean-cache: ## Clear application cache
	@echo "$(YELLOW)Clearing application cache...$(NC)"
	rm -rf cache/*
	docker-compose -f $(COMPOSE_FILE) exec $(PROJECT_NAME) rm -rf /app/cache/* || true
	@echo "$(GREEN)Cache cleared!$(NC)"

reset: clean dev ## Complete reset and restart

# Security Commands
security-scan: ## Run security scan on Docker images
	@echo "$(GREEN)Running security scan...$(NC)"
	docker build -t $(PROJECT_NAME):scan .
	@if command -v trivy >/dev/null 2>&1; then \
		trivy image $(PROJECT_NAME):scan; \
	else \
		echo "$(YELLOW)Trivy not installed. Install with: brew install trivy$(NC)"; \
	fi

audit: ## Run npm audit
	@echo "$(GREEN)Running security audit...$(NC)"
	npm audit --audit-level moderate

# Development Utilities
shell: ## Open shell in running container
	docker-compose -f $(COMPOSE_FILE) exec $(PROJECT_NAME) /bin/sh

shell-test: ## Open shell in test container
	docker-compose -f $(TEST_COMPOSE_FILE) run --rm integration-tests /bin/sh

install: ## Install development dependencies
	@echo "$(GREEN)Installing dependencies...$(NC)"
	npm ci
	@echo "Installing test dependencies..."
	cd tests/integration && npm ci

setup: ## Initial project setup
	@echo "$(GREEN)Setting up MCP Documentation Server...$(NC)"
	@mkdir -p secrets cache logs test-results
	@if [ ! -f docker.env ]; then cp docker.env.example docker.env; fi
	@if [ ! -f secrets/github_token.txt ]; then \
		echo "dummy-setup-token" > secrets/github_token.txt; \
		chmod 600 secrets/github_token.txt; \
	fi
	@echo "$(GREEN)Setup complete! Run 'make dev' to start.$(NC)"

# CI/CD Commands
ci: test-integration-ci ## Run CI pipeline locally

release-check: ## Check if ready for release
	@echo "$(GREEN)Checking release readiness...$(NC)"
	@./scripts/run-integration-tests.sh
	@echo "$(GREEN)Release check complete!$(NC)"

# Documentation
docs: ## Generate documentation
	@echo "$(GREEN)Documentation available at:$(NC)"
	@echo "  README.md         - Main documentation"
	@echo "  API.md           - API reference"
	@echo "  CONFIGURATION.md - Configuration guide"
	@echo "  DOCKER.md        - Docker deployment"
	@echo "  SECURITY.md      - Security documentation"

# Quick commands for common workflows
quick-test: ## Quick integration test (minimal output)
	@docker-compose -f $(TEST_COMPOSE_FILE) up -d mcp-docs-server-test >/dev/null 2>&1
	@timeout 120 bash -c 'until docker-compose -f $(TEST_COMPOSE_FILE) exec -T mcp-docs-server-test curl -f http://localhost:3000/health >/dev/null 2>&1; do sleep 2; done'
	@docker-compose -f $(TEST_COMPOSE_FILE) run --rm integration-tests >/dev/null 2>&1 && echo "$(GREEN)✅ Tests passed$(NC)" || echo "$(RED)❌ Tests failed$(NC)"
	@docker-compose -f $(TEST_COMPOSE_FILE) down >/dev/null 2>&1

quick-health: ## Quick health check
	@curl -s http://localhost:3000/health >/dev/null && echo "$(GREEN)✅ Healthy$(NC)" || echo "$(RED)❌ Unhealthy$(NC)"