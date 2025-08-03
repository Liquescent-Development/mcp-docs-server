# MCP Documentation Server

A Model Context Protocol (MCP) server that provides Claude Code with direct access to technical documentation, enabling more accurate and contextual development assistance.

## Overview

This MCP server enhances Claude Code's capabilities by:
- Providing real-time access to documentation (Electron, React, Node.js, etc.)
- Searching and retrieving relevant API references
- Finding code examples and best practices
- Caching documentation for faster access
- Supporting multiple documentation sources

## Features

- **Multi-source documentation support**: Electron, React, Node.js, and more
- **Intelligent search**: Context-aware documentation retrieval
- **Caching system**: Fast access to frequently used docs
- **Example finder**: Locate relevant code examples
- **API reference lookup**: Quick access to method signatures and usage
- **Version-aware**: Handle different versions of technologies

## Architecture

```
src/
├── tools/           # MCP tools exposed to Claude
├── scrapers/        # Documentation scrapers for different sources
├── cache/          # Caching system for performance
├── utils/          # Shared utilities
└── types.ts        # TypeScript type definitions
```

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```
4. Configure your documentation sources in `config/default.json`
5. Build the project:
   ```bash
   npm run build
   ```

## Configuration

Configure documentation sources in `config/default.json`:

```json
{
  "documentation": {
    "sources": {
      "electron": {
        "url": "https://electronjs.org/docs",
        "enabled": true,
        "cache_ttl": 3600
      },
      "react": {
        "url": "https://react.dev/reference",
        "enabled": true,
        "cache_ttl": 3600
      }
    }
  },
  "cache": {
    "type": "file",
    "directory": "./cache",
    "max_size": "100MB"
  }
}
```

## Usage with Claude Code

1. Start the MCP server:
   ```bash
   npm start
   ```

2. Configure Claude Code to use this MCP server by adding to your MCP configuration:
   ```json
   {
     "mcpServers": {
       "docs": {
         "command": "node",
         "args": ["/path/to/mcp-docs-server/dist/index.js"]
       }
     }
   }
   ```

3. Use in Claude Code conversations:
   ```
   # Claude can now access documentation directly
   "Help me implement Electron IPC communication"
   # Claude will automatically search Electron docs for IPC examples
   ```

## Available Tools

### `search_documentation`
Search across all configured documentation sources.
```typescript
search_documentation({
  query: "electron ipc main process",
  technology: "electron", // optional
  type: "api" | "guide" | "example" // optional
})
```

### `get_api_reference`
Get specific API documentation.
```typescript
get_api_reference({
  technology: "electron",
  api: "BrowserWindow",
  method: "loadURL" // optional
})
```

### `find_examples`
Find code examples for specific use cases.
```typescript
find_examples({
  technology: "electron",
  use_case: "context menu",
  language: "typescript" // optional
})
```

### `get_migration_guide`
Get migration information between versions.
```typescript
get_migration_guide({
  technology: "electron",
  from_version: "22",
  to_version: "latest"
})
```

## Development

### Prerequisites
- Node.js 18+
- TypeScript 5+
- npm or yarn

### Setup Development Environment
```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Adding New Documentation Sources

1. Create a new scraper in `src/scrapers/`
2. Implement the `DocumentationScraper` interface
3. Add configuration in `config/default.json`
4. Register the scraper in `src/scrapers/index.ts`

Example:
```typescript
// src/scrapers/my-tech.ts
export class MyTechScraper implements DocumentationScraper {
  async search(query: string): Promise<DocumentationResult[]> {
    // Implementation
  }
  
  async getApiReference(api: string): Promise<ApiReference> {
    // Implementation
  }
}
```

### Testing

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run all tests with coverage
npm run test:coverage
```

## Configuration Options

See [CONFIGURATION.md](docs/CONFIGURATION.md) for detailed configuration options.

## API Documentation

See [API.md](docs/API.md) for complete API documentation.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Roadmap

- [ ] Support for more documentation sources (Vue, Angular, etc.)
- [ ] AI-powered documentation summarization
- [ ] Integration with IDE extensions
- [ ] Real-time documentation updates
- [ ] Custom documentation source plugins
- [ ] Semantic search capabilities

## Troubleshooting

### Common Issues

**Server won't start**
- Check that all dependencies are installed
- Verify configuration files are valid JSON
- Check that ports are not in use

**Documentation not found**
- Verify source URLs are accessible
- Check cache directory permissions
- Review scraper configurations

**Performance issues**
- Adjust cache TTL settings
- Consider reducing concurrent scraping
- Monitor memory usage

For more help, see [DEVELOPMENT.md](docs/DEVELOPMENT.md) or open an issue.