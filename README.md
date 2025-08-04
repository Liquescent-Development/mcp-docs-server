# MCP Documentation Server

A Model Context Protocol (MCP) server that provides Claude Code with direct access to technical documentation from multiple sources, enabling more accurate and contextual development assistance.

## Overview

This MCP server enhances Claude Code's capabilities by providing real-time access to:
- **Electron Documentation** - Complete API reference and examples
- **React Documentation** - Component APIs and usage patterns  
- **Node.js Documentation** - Runtime APIs and guides
- **GitHub Documentation** - Repository content and API references

## Features

- 🔍 **Intelligent Search** - Search across multiple documentation sources simultaneously
- 📚 **API Reference Lookup** - Get detailed documentation for specific APIs and methods
- 💡 **Example Finder** - Locate relevant code examples with syntax highlighting
- 🔄 **Migration Guides** - Version-to-version upgrade assistance
- ⚡ **Advanced Caching** - Two-tier caching (memory + file) for optimal performance
- 🔒 **Security Hardened** - SSRF protection, input validation, and secure file operations
- 🐳 **Docker Ready** - Production deployment with Docker Compose
- 🏥 **Health Monitoring** - Built-in health check endpoint at `/health`
- ✅ **Comprehensive Testing** - Full integration test suite with Docker-based testing environment

## Architecture

```
src/
├── tools/           # MCP tools (search, api_reference, examples, migration)
├── scrapers/        # Documentation scrapers (Electron, React, Node.js, GitHub)
├── cache/          # Two-tier caching system (memory + file storage)
├── utils/          # Utilities (logging, parsing, cache management)
├── server.ts       # MCP server implementation
├── index.ts        # Application entry point
└── types.ts        # TypeScript definitions and Zod schemas
```

## Quick Start

### Prerequisites
- **Node.js 20+** (LTS recommended for security)
- **npm** or **yarn**

### Installation

1. **Clone and install**:
   ```bash
   git clone https://github.com/Liquescent-Development/mcp-docs-server.git
   cd mcp-docs-server
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your documentation source URLs
   ```

3. **Build and start**:
   ```bash
   npm run build
   npm start
   ```

## Configuration

### Environment Variables

Create a `.env` file with your documentation sources:

```bash
# Documentation Sources (at least one required)
DOCS_ELECTRON_URL=https://www.electronjs.org
DOCS_REACT_URL=https://react.dev
DOCS_NODE_URL=https://nodejs.org
DOCS_GITHUB_URL=https://docs.github.com

# GitHub Integration (optional, for higher rate limits)
GITHUB_TOKEN=ghp_your_token_here

# Server Configuration
PORT=3000
NODE_ENV=production

# Caching
CACHE_DIR=./cache
CACHE_TTL=3600
CACHE_STORAGE=both

# Performance
RATE_LIMIT_PER_MINUTE=60

# Logging
LOG_LEVEL=info
```

### Docker Deployment

```bash
# Quick start with Docker
cp docker.env.example docker.env
# Edit docker.env with your configuration
docker-compose up -d

# View logs
docker-compose logs -f

# Check health
curl http://localhost:3000/health
```

The Docker setup includes:
- 🔐 **Security hardened** - Non-root user, minimal Alpine image
- 💾 **Persistent storage** - Volumes for cache and logs
- 🏥 **Health monitoring** - Built-in health checks at `/health`
- 📊 **Resource limits** - CPU and memory constraints
- 🔧 **Easy configuration** - All settings via environment variables

See [DOCKER.md](DOCKER.md) for detailed Docker deployment guide.

## Usage with Claude Code

### 1. Configure Claude Code

Add to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "docs": {
      "command": "node",
      "args": ["/path/to/mcp-docs-server/dist/index.js"],
      "env": {
        "DOCS_ELECTRON_URL": "https://www.electronjs.org",
        "DOCS_REACT_URL": "https://react.dev",
        "DOCS_NODE_URL": "https://nodejs.org"
      }
    }
  }
}
```

### 2. Available Tools

The server provides four MCP tools:

#### `search_documentation`
Search across multiple documentation sources:
```typescript
// Claude Code will automatically use this when you ask:
// "How do I create a window in Electron?"
search_documentation({
  query: "create browser window",
  sources: ["electron"],
  type: "api",
  limit: 10
})
```

#### `get_api_reference`
Get detailed API documentation:
```typescript
// "Show me the BrowserWindow API documentation"
get_api_reference({
  apiName: "BrowserWindow",
  source: "electron",
  version: "latest"
})
```

#### `find_examples`
Find code examples:
```typescript
// "Find TypeScript examples for React hooks"
find_examples({
  topic: "hooks",
  sources: ["react"],
  language: "typescript",
  limit: 5
})
```

#### `get_migration_guide`
Get version migration guides:
```typescript
// "How do I migrate from React 17 to 18?"
get_migration_guide({
  source: "react", 
  fromVersion: "17.0.0",
  toVersion: "18.0.0"
})
```

### 3. Example Conversations

```text
User: "I need to create an Electron app with a custom menu"

Claude: I'll help you create an Electron app with a custom menu. Let me get the latest documentation for you.
[Claude automatically uses search_documentation and get_api_reference]

Based on the Electron documentation, here's how to create a custom menu:
[Provides accurate, up-to-date code examples from real Electron docs]
```

## Development

### Setup Development Environment

```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Lint code
npm run lint
```

### Testing

The project includes a comprehensive Docker-based integration test suite:

```bash
# Run all tests (unit + integration)
npm run test:all

# Run unit tests only
npm run test:unit

# Run integration tests with Docker
npm run test:integration

# Run integration tests in CI mode
npm run test:integration:ci

# Run performance tests
npm run test:performance

# Run tests with coverage
npm run test:coverage
```

**Test Architecture:**
- 🏗️ **Docker-based Integration Tests** - Full system testing in isolated environment
- 🔍 **MCP Tools Testing** - WebSocket-based testing of all four MCP tools
- 🏥 **Health & Monitoring** - System health and performance validation
- 🛡️ **Security Testing** - Error handling, input validation, SSRF protection
- ⚡ **Performance Testing** - Load testing, memory usage, response times

**Quick Testing:**
```bash
# Using Make commands (recommended)
make test-integration    # Full integration test suite
make test-performance    # Performance tests only
make quick-test         # Fast health check
make ci                 # CI pipeline simulation

# Using test script directly
./scripts/run-integration-tests.sh
```

See [TESTING.md](TESTING.md) for detailed testing guide and architecture.

### Adding New Documentation Sources

1. **Create a scraper** in `src/scrapers/`:
   ```typescript
   // src/scrapers/my-docs.ts
   import { BaseScraper } from './base.js';
   
   export class MyDocsScraper extends BaseScraper {
     constructor(config: ScraperConfig) {
       super(config, 'my-docs');
     }
     
     async scrape(params: Record<string, any>): Promise<ScraperResult> {
       // Implementation
     }
     
     // ... other required methods
   }
   ```

2. **Add configuration** in `.env`:
   ```bash
   DOCS_MYDOCS_URL=https://mydocs.com
   ```

3. **Register the scraper** in the server configuration

## Security Features

- 🛡️ **SSRF Protection** - Blocks requests to private networks and localhost
- 🔐 **Input Validation** - All inputs sanitized and validated with Zod schemas  
- 📝 **Secure Logging** - Sensitive data automatically redacted from logs
- 📁 **File Security** - Restricted permissions and path traversal protection
- 🚫 **Error Handling** - Safe error messages that don't expose internal details

## Performance

- ⚡ **Two-Tier Caching** - Memory cache + persistent file storage
- 📊 **Rate Limiting** - Configurable per-source request limits
- 🔄 **Concurrent Processing** - Batch requests with controlled concurrency
- ⏱️ **Smart TTL** - Different cache durations for different content types

**Cache TTL by Content Type:**
- Search results: 30 minutes
- API references: 1 hour  
- Code examples: 30 minutes
- Migration guides: 2 hours

## Documentation

- 📖 **[API.md](docs/API.md)** - Complete API reference for all MCP tools
- ⚙️ **[CONFIGURATION.md](docs/CONFIGURATION.md)** - Detailed configuration guide
- 🐳 **[DOCKER.md](DOCKER.md)** - Docker deployment guide
- 🧪 **[tests/README.md](tests/README.md)** - Testing guide and best practices

## Monitoring & Troubleshooting

### Health Check
```bash
# Check if server is running
curl http://localhost:3000/health

# View logs
tail -f logs/combined.log

# Check cache statistics
# (Available through logging with debug level)
```

### Common Issues

**"No documentation sources configured"**
```bash
# Ensure at least one DOCS_*_URL is set
echo "DOCS_ELECTRON_URL=https://www.electronjs.org" >> .env
```

**Rate limiting errors**
```bash
# Increase rate limit or add GitHub token
RATE_LIMIT_PER_MINUTE=120
GITHUB_TOKEN=your_github_token
```

**Cache permission errors**
```bash
# Fix cache directory permissions
mkdir -p ./cache
chmod 700 ./cache
```

For detailed troubleshooting, see [CONFIGURATION.md](docs/CONFIGURATION.md).

## Production Deployment

### Minimum Requirements
- **Node.js 20+** (for security updates)
- **2GB RAM** (for caching)
- **10GB disk space** (for cache storage)
- **Reliable internet** (for documentation fetching)

### Recommended Configuration
```bash
NODE_ENV=production
LOG_LEVEL=warn
CACHE_TTL=7200
RATE_LIMIT_PER_MINUTE=120
CACHE_STORAGE=both
```

### Process Management
```bash
# Using PM2
npm install -g pm2
pm2 start dist/index.js --name mcp-docs-server

# Using Docker
docker-compose up -d
```

## Contributing

We welcome contributions! Please:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Make** your changes
4. **Add** tests for new functionality
5. **Ensure** all tests pass (`npm test`)
6. **Submit** a pull request

### Development Guidelines
- Follow existing code style (ESLint configuration)
- Add tests for new features
- Update documentation as needed
- Ensure security best practices

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Roadmap

### Current Version (1.0.0)
- ✅ Core MCP tools implementation
- ✅ Multi-source documentation scraping
- ✅ Advanced caching system
- ✅ Security hardening
- ✅ Comprehensive testing

### Future Enhancements
- [ ] **Additional Sources** - Vue.js, Angular, Python, Rust documentation
- [ ] **AI Summarization** - Intelligent documentation summaries
- [ ] **Semantic Search** - Vector-based content search
- [ ] **Plugin System** - Custom documentation source plugins
- [ ] **Real-time Sync** - Live documentation updates
- [ ] **Analytics** - Usage metrics and performance monitoring
- [ ] **GraphQL API** - Alternative to MCP protocol
- [ ] **Web Interface** - Browser-based documentation explorer

## Support

- 📧 **Issues**: [GitHub Issues](https://github.com/Liquescent-Development/mcp-docs-server/issues)
- 📚 **Documentation**: [docs/](docs/) directory
- 💬 **Discussions**: [GitHub Discussions](https://github.com/Liquescent-Development/mcp-docs-server/discussions)

---

**Built with ❤️ for the Claude Code community**