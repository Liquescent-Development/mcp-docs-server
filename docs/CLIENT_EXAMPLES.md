# MCP Client Examples

This document provides practical examples for connecting to the MCP Documentation Server using both stdio and HTTP/SSE transports.

## Stdio Transport Examples

### Claude Desktop Configuration

The simplest way to use the MCP Documentation Server with Claude Desktop:

**File: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)**
**File: `%APPDATA%/Claude/claude_desktop_config.json` (Windows)**
**File: `~/.config/claude/claude_desktop_config.json` (Linux)**

```json
{
  "mcpServers": {
    "docs": {
      "command": "node",
      "args": ["/path/to/mcp-docs-server/dist/index.js"],
      "env": {
        "DOCS_ELECTRON_URL": "https://www.electronjs.org",
        "DOCS_REACT_URL": "https://react.dev",
        "DOCS_NODE_URL": "https://nodejs.org",
        "CACHE_DIR": "./cache",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Node.js MCP Client (Stdio)

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function createStdioClient() {
  // Start the MCP server process
  const serverProcess = spawn('node', ['/path/to/mcp-docs-server/dist/index.js'], {
    env: {
      ...process.env,
      DOCS_ELECTRON_URL: 'https://www.electronjs.org',
      DOCS_REACT_URL: 'https://react.dev',
      DOCS_NODE_URL: 'https://nodejs.org'
    }
  });

  // Create transport
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['/path/to/mcp-docs-server/dist/index.js'],
    env: {
      DOCS_ELECTRON_URL: 'https://www.electronjs.org',
      DOCS_REACT_URL: 'https://react.dev'
    }
  });

  // Create client
  const client = new Client({
    name: 'mcp-docs-client',
    version: '1.0.0'
  }, {
    capabilities: {
      tools: {}
    }
  });

  // Connect
  await client.connect(transport);

  return client;
}

// Usage example
async function searchDocs() {
  const client = await createStdioClient();
  
  try {
    // Search for documentation
    const result = await client.callTool({
      name: 'search_documentation',
      arguments: {
        query: 'window creation',
        sources: ['electron'],
        limit: 5
      }
    });
    
    console.log('Search Results:', result);
  } finally {
    await client.close();
  }
}

searchDocs().catch(console.error);
```

## HTTP/SSE Transport Examples

### Claude Desktop HTTP Configuration

Configure Claude Desktop to use HTTP transport:

```json
{
  "mcpServers": {
    "docs": {
      "sse": {
        "url": "http://localhost:3000/mcp",
        "timeout": 30000,
        "retryInterval": 5000,
        "maxRetries": 3
      },
      "env": {
        "DOCS_ELECTRON_URL": "https://www.electronjs.org",
        "DOCS_REACT_URL": "https://react.dev",
        "DOCS_NODE_URL": "https://nodejs.org"
      }
    }
  }
}
```

### Web Client Example (JavaScript)

```html
<!DOCTYPE html>
<html>
<head>
    <title>MCP Docs Client</title>
</head>
<body>
    <h1>MCP Documentation Client</h1>
    <input type="text" id="searchQuery" placeholder="Search documentation...">
    <button onclick="searchDocs()">Search</button>
    <div id="results"></div>

    <script>
        let sessionId = null;
        let messageId = 1;

        // Establish SSE connection
        async function connectToMCP() {
            const eventSource = new EventSource('http://localhost:3000/mcp');
            
            eventSource.onopen = () => {
                console.log('SSE connection established');
            };
            
            eventSource.onmessage = (event) => {
                if (event.lastEventId === 'endpoint') {
                    // Extract session ID from endpoint URL
                    const match = event.data.match(/sessionId=([a-f0-9-]+)/);
                    if (match) {
                        sessionId = match[1];
                        console.log('Session ID:', sessionId);
                        
                        // Initialize MCP connection
                        initializeMCP();
                    }
                }
            };
            
            eventSource.onerror = (error) => {
                console.error('SSE error:', error);
            };
            
            return eventSource;
        }

        // Initialize MCP protocol
        async function initializeMCP() {
            if (!sessionId) return;
            
            const response = await fetch(`http://localhost:3000/mcp?sessionId=${sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: messageId++,
                    method: 'initialize',
                    params: {
                        protocolVersion: '2025-06-18',
                        capabilities: { tools: {} },
                        clientInfo: { name: 'web-client', version: '1.0.0' }
                    }
                })
            });
            
            const result = await response.json();
            console.log('Initialize result:', result);
        }

        // Search documentation
        async function searchDocs() {
            if (!sessionId) {
                alert('Not connected to MCP server');
                return;
            }
            
            const query = document.getElementById('searchQuery').value;
            if (!query) return;
            
            try {
                const response = await fetch(`http://localhost:3000/mcp?sessionId=${sessionId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: messageId++,
                        method: 'tools/call',
                        params: {
                            name: 'search_documentation',
                            arguments: {
                                query: query,
                                sources: ['electron', 'react', 'node'],
                                limit: 5
                            }
                        }
                    })
                });
                
                const result = await response.json();
                
                if (result.error) {
                    console.error('Search error:', result.error);
                    document.getElementById('results').innerHTML = 
                        `<p style="color: red;">Error: ${result.error.message}</p>`;
                } else {
                    const content = result.result.content[0].text;
                    document.getElementById('results').innerHTML = 
                        `<pre>${content}</pre>`;
                }
            } catch (error) {
                console.error('Request error:', error);
                document.getElementById('results').innerHTML = 
                    `<p style="color: red;">Request failed: ${error.message}</p>`;
            }
        }

        // Connect when page loads
        window.onload = () => {
            connectToMCP();
        };
    </script>
</body>
</html>
```

### Node.js HTTP Client

```javascript
import fetch from 'node-fetch';
import EventSource from 'eventsource';

class MCPHttpClient {
    constructor(serverUrl = 'http://localhost:3000') {
        this.serverUrl = serverUrl;
        this.sessionId = null;
        this.messageId = 1;
        this.eventSource = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.eventSource = new EventSource(`${this.serverUrl}/mcp`);
            
            this.eventSource.onopen = () => {
                console.log('Connected to MCP server');
            };
            
            this.eventSource.onmessage = async (event) => {
                if (event.lastEventId === 'endpoint') {
                    const match = event.data.match(/sessionId=([a-f0-9-]+)/);
                    if (match) {
                        this.sessionId = match[1];
                        console.log('Session ID:', this.sessionId);
                        
                        // Initialize MCP connection
                        await this.initialize();
                        resolve();
                    }
                }
            };
            
            this.eventSource.onerror = (error) => {
                console.error('SSE error:', error);
                reject(error);
            };
        });
    }

    async initialize() {
        const response = await this.sendMessage('initialize', {
            protocolVersion: '2025-06-18',
            capabilities: { tools: {} },
            clientInfo: { name: 'node-http-client', version: '1.0.0' }
        });
        
        console.log('Initialize response:', response);
        return response;
    }

    async sendMessage(method, params = {}) {
        if (!this.sessionId) {
            throw new Error('Not connected - call connect() first');
        }

        const message = {
            jsonrpc: '2.0',
            id: this.messageId++,
            method,
            params
        };

        const response = await fetch(`${this.serverUrl}/mcp?sessionId=${this.sessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
        });

        const result = await response.json();
        
        if (result.error) {
            throw new Error(`MCP Error: ${result.error.message}`);
        }
        
        return result.result;
    }

    async searchDocumentation(query, sources = ['electron', 'react', 'node'], limit = 10) {
        return await this.sendMessage('tools/call', {
            name: 'search_documentation',
            arguments: { query, sources, limit }
        });
    }

    async getApiReference(apiName, source) {
        return await this.sendMessage('tools/call', {
            name: 'get_api_reference',
            arguments: { apiName, source }
        });
    }

    async findExamples(topic, sources = ['electron', 'react', 'node'], language = null) {
        const args = { topic, sources };
        if (language) args.language = language;
        
        return await this.sendMessage('tools/call', {
            name: 'find_examples',
            arguments: args
        });
    }

    async getMigrationGuide(source, fromVersion, toVersion) {
        return await this.sendMessage('tools/call', {
            name: 'get_migration_guide',
            arguments: { source, fromVersion, toVersion }
        });
    }

    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        this.sessionId = null;
        this.messageId = 1;
    }
}

// Usage example
async function main() {
    const client = new MCPHttpClient();
    
    try {
        await client.connect();
        
        // Search for Electron documentation
        const searchResults = await client.searchDocumentation('BrowserWindow', ['electron']);
        console.log('Search Results:', searchResults.content[0].text);
        
        // Get API reference
        const apiRef = await client.getApiReference('BrowserWindow', 'electron');
        console.log('API Reference:', apiRef.content[0].text);
        
        // Find examples
        const examples = await client.findExamples('window creation', ['electron'], 'javascript');
        console.log('Examples:', examples.content[0].text);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.disconnect();
    }
}

main().catch(console.error);
```

### Python HTTP Client

```python
import asyncio
import aiohttp
import json
from typing import Dict, List, Optional

class MCPHttpClient:
    def __init__(self, server_url: str = "http://localhost:3000"):
        self.server_url = server_url
        self.session_id = None
        self.message_id = 1
        self.session = None

    async def connect(self):
        self.session = aiohttp.ClientSession()
        
        # Establish SSE connection
        async with self.session.get(f"{self.server_url}/mcp") as response:
            async for line in response.content:
                if line.startswith(b"data: "):
                    data = line[6:].decode().strip()
                    if "sessionId=" in data:
                        # Extract session ID
                        import re
                        match = re.search(r'sessionId=([a-f0-9-]+)', data)
                        if match:
                            self.session_id = match.group(1)
                            print(f"Session ID: {self.session_id}")
                            break
        
        # Initialize MCP connection
        await self.initialize()

    async def initialize(self):
        response = await self.send_message("initialize", {
            "protocolVersion": "2025-06-18",
            "capabilities": {"tools": {}},
            "clientInfo": {"name": "python-http-client", "version": "1.0.0"}
        })
        print("Initialize response:", response)
        return response

    async def send_message(self, method: str, params: Dict = None) -> Dict:
        if not self.session_id:
            raise RuntimeError("Not connected - call connect() first")

        message = {
            "jsonrpc": "2.0",
            "id": self.message_id,
            "method": method,
            "params": params or {}
        }
        self.message_id += 1

        url = f"{self.server_url}/mcp?sessionId={self.session_id}"
        async with self.session.post(url, json=message) as response:
            result = await response.json()
            
            if "error" in result:
                raise RuntimeError(f"MCP Error: {result['error']['message']}")
            
            return result.get("result", {})

    async def search_documentation(self, query: str, sources: List[str] = None, limit: int = 10) -> Dict:
        sources = sources or ["electron", "react", "node"]
        return await self.send_message("tools/call", {
            "name": "search_documentation",
            "arguments": {"query": query, "sources": sources, "limit": limit}
        })

    async def get_api_reference(self, api_name: str, source: str) -> Dict:
        return await self.send_message("tools/call", {
            "name": "get_api_reference",
            "arguments": {"apiName": api_name, "source": source}
        })

    async def find_examples(self, topic: str, sources: List[str] = None, language: Optional[str] = None) -> Dict:
        sources = sources or ["electron", "react", "node"]
        args = {"topic": topic, "sources": sources}
        if language:
            args["language"] = language
        
        return await self.send_message("tools/call", {
            "name": "find_examples",
            "arguments": args
        })

    async def get_migration_guide(self, source: str, from_version: str, to_version: str) -> Dict:
        return await self.send_message("tools/call", {
            "name": "get_migration_guide",
            "arguments": {"source": source, "fromVersion": from_version, "toVersion": to_version}
        })

    async def disconnect(self):
        if self.session:
            await self.session.close()
            self.session = None
        self.session_id = None
        self.message_id = 1

# Usage example
async def main():
    client = MCPHttpClient()
    
    try:
        await client.connect()
        
        # Search for documentation
        search_results = await client.search_documentation("BrowserWindow", ["electron"])
        print("Search Results:", search_results["content"][0]["text"])
        
        # Get API reference
        api_ref = await client.get_api_reference("BrowserWindow", "electron")
        print("API Reference:", api_ref["content"][0]["text"])
        
    except Exception as error:
        print(f"Error: {error}")
    finally:
        await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
```

## Docker Compose for HTTP Transport

When using Docker, the HTTP transport is particularly useful:

```yaml
version: '3.8'
services:
  mcp-docs-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - TRANSPORT_MODE=http
      - DOCS_ELECTRON_URL=https://www.electronjs.org
      - DOCS_REACT_URL=https://react.dev
      - DOCS_NODE_URL=https://nodejs.org
      - HTTP_TRANSPORT_ENABLED=true
      - CORS_ORIGIN=*
    volumes:
      - ./cache:/app/cache
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

Then configure Claude Desktop to use the containerized server:

```json
{
  "mcpServers": {
    "docs": {
      "sse": {
        "url": "http://localhost:3000/mcp",
        "timeout": 30000
      }
    }
  }
}
```

## Testing Your Connection

### Health Check
```bash
curl http://localhost:3000/health
```

### Test SSE Connection
```bash
curl -N -H "Accept: text/event-stream" http://localhost:3000/mcp
```

### Test Tool Call (requires active session)
```bash
# First establish SSE connection to get session ID, then:
curl -X POST "http://localhost:3000/mcp?sessionId=YOUR_SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "search_documentation",
      "arguments": {
        "query": "window creation",
        "sources": ["electron"]
      }
    }
  }'
```

## Troubleshooting

### Common Issues

1. **Session ID not found**: Make sure to keep the SSE connection open when making POST requests
2. **CORS errors**: Configure `CORS_ORIGIN` in your environment variables
3. **Connection timeouts**: Increase `SESSION_TIMEOUT` for long-running operations
4. **Rate limiting**: Adjust `HTTP_RATE_LIMIT_REQUESTS_PER_MINUTE` if needed

### Debug Mode

Enable debug logging for troubleshooting:

```bash
LOG_LEVEL=debug npm start
```

This provides detailed information about:
- HTTP request/response cycles
- Session management
- SSE connection events
- Tool execution details