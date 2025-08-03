# MCP Documentation Server API Reference

This document provides comprehensive documentation for all MCP tools available in the documentation server.

## Overview

The MCP Documentation Server provides four main tools for accessing technical documentation:

- `search_documentation` - Search across multiple documentation sources
- `get_api_reference` - Get detailed API reference documentation
- `find_examples` - Find code examples for specific topics
- `get_migration_guide` - Get version migration guides

## Authentication

The server uses the Model Context Protocol (MCP) for communication. No additional authentication is required beyond the MCP connection.

## Supported Documentation Sources

- **Electron**: Electron framework documentation
- **React**: React library documentation  
- **Node.js**: Node.js runtime documentation
- **GitHub**: GitHub repository documentation and API

---

## Tools Reference

### 1. search_documentation

Search across multiple documentation sources for specific topics.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query string (max 1000 chars) |
| `sources` | array | No | Specific sources to search. Options: `["electron", "react", "node", "github"]` |
| `type` | string | No | Filter by documentation type. Options: `"api"`, `"guide"`, `"example"`, `"migration"` |
| `limit` | number | No | Maximum results to return (1-100, default: 10) |

#### Example Request

```json
{
  "query": "window creation",
  "sources": ["electron", "react"],
  "type": "api",
  "limit": 5
}
```

#### Example Response

```markdown
# Search Results for "window creation"

Found 12 results across electron, react

## 1. BrowserWindow
**Source:** electron | **Type:** api
**URL:** https://electronjs.org/docs/api/browser-window

Creates and manages browser windows...

---

## 2. Window Object
**Source:** react | **Type:** api  
**URL:** https://react.dev/reference/react-dom/window

The window object represents the browser window...
```

#### Error Responses

- **400 Bad Request**: Invalid query parameters
- **500 Internal Server Error**: Server processing error

---

### 2. get_api_reference

Get detailed API reference documentation for a specific method or class.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `apiName` | string | Yes | API name or method to look up |
| `source` | string | Yes | Documentation source. Options: `"electron"`, `"react"`, `"node"`, `"github"` |
| `version` | string | No | Specific version (defaults to latest) |

#### Example Request

```json
{
  "apiName": "BrowserWindow",
  "source": "electron",
  "version": "latest"
}
```

#### Example Response

```markdown
# BrowserWindow

**Source:** electron | **Type:** api
**URL:** https://electronjs.org/docs/api/browser-window
**Last Updated:** 2024-01-15T10:30:00.000Z

## Content

Create and control browser windows.

### Constructor

new BrowserWindow([options])
- options Object (optional)
  - width Integer (optional) - Window's width in pixels. Default is 800.
  - height Integer (optional) - Window's height in pixels. Default is 600.
  ...

### Methods

#### win.loadURL(url[, options])
- url String
- options Object (optional)
  - httpReferrer String | Referrer - A HTTP Referrer url.
  ...

## Metadata
```json
{
  "parsedFrom": "electron-docs",
  "apiVersion": "latest"
}
```
```

#### Error Responses

- **404 Not Found**: API reference not found for the specified name
- **400 Bad Request**: Invalid source or parameters
- **500 Internal Server Error**: Server processing error

---

### 3. find_examples

Find code examples for specific topics or APIs.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `topic` | string | Yes | Topic or API to find examples for |
| `sources` | array | No | Specific sources to search |
| `language` | string | No | Filter by code language. Options: `"javascript"`, `"typescript"`, `"jsx"`, `"tsx"` |
| `limit` | number | No | Maximum examples to return (1-50, default: 5) |

#### Example Request

```json
{
  "topic": "file upload",
  "sources": ["react", "node"],
  "language": "typescript",
  "limit": 3
}
```

#### Example Response

```markdown
# Code Examples (3 found)

## Example 1: File Upload Component
**Source:** react
**URL:** https://react.dev/examples/file-upload
**Language:** typescript

```typescript
import React, { useState } from 'react';

const FileUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };
  
  return (
    <input type="file" onChange={handleFileChange} />
  );
};
```

---

## Example 2: Express File Upload
**Source:** node
**URL:** https://nodejs.org/examples/file-upload
**Language:** typescript

```typescript
import express from 'express';
import multer from 'multer';

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('file'), (req, res) => {
  console.log(req.file);
  res.send('File uploaded successfully');
});
```
```

#### Error Responses

- **404 Not Found**: No examples found for the specified topic
- **400 Bad Request**: Invalid parameters
- **500 Internal Server Error**: Server processing error

---

### 4. get_migration_guide

Get migration guides between different versions of a framework or library.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source` | string | Yes | Documentation source. Options: `"electron"`, `"react"`, `"node"`, `"github"` |
| `fromVersion` | string | Yes | Starting version |
| `toVersion` | string | Yes | Target version |

#### Example Request

```json
{
  "source": "react",
  "fromVersion": "17.0.0",
  "toVersion": "18.0.0"
}
```

#### Example Response

```markdown
# Migration Guide: react 17.0.0 ’ 18.0.0

## Breaking Changes in React 18

### Automatic Batching

React 18 introduces automatic batching for all updates, including those in promises, timeouts, and native event handlers.

**Before (React 17):**
```javascript
setTimeout(() => {
  setCount(c => c + 1);
  setFlag(f => !f);
  // React will render twice, once for each state update
}, 1000);
```

**After (React 18):**
```javascript
setTimeout(() => {
  setCount(c => c + 1);
  setFlag(f => !f);
  // React will only render once at the end
}, 1000);
```

### Strict Mode Changes

React 18 Strict Mode will now double-invoke effects to help detect side effects.

### Additional Information
- From Version: 17.0.0
- To Version: 18.0.0
```

#### Error Responses

- **404 Not Found**: No migration guide found for the specified version range
- **400 Bad Request**: Invalid version parameters
- **500 Internal Server Error**: Server processing error

---

## Error Handling

All tools return errors in a consistent format:

### Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details (optional)"
  }
}
```

### Common Error Codes

- `INVALID_PARAMS`: Invalid or missing parameters
- `SOURCE_NOT_FOUND`: Specified documentation source not configured
- `CONTENT_NOT_FOUND`: Requested content not found
- `RATE_LIMIT_EXCEEDED`: Too many requests (if rate limiting is enabled)
- `INTERNAL_ERROR`: Server processing error

---

## Rate Limiting

The server implements rate limiting to prevent abuse:

- **Default Limit**: 60 requests per minute per source
- **Configurable**: Set via `RATE_LIMIT_PER_MINUTE` environment variable
- **Behavior**: Requests are queued and processed with delays when limits are exceeded

---

## Caching

The server uses a two-tier caching system to improve performance:

### Cache Layers

1. **Memory Cache**: Fast in-memory storage using node-cache
2. **File Cache**: Persistent file-based storage

### Cache TTL (Time To Live)

- **Search Results**: 30 minutes
- **API References**: 1 hour  
- **Examples**: 30 minutes
- **Migration Guides**: 2 hours

### Cache Configuration

Cache behavior can be configured via environment variables:

- `CACHE_TTL`: Default cache TTL in seconds (default: 3600)
- `CACHE_STORAGE`: Storage type - `memory`, `file`, or `both` (default: both)
- `CACHE_DIR`: Directory for file cache (default: ./cache)

---

## Performance Considerations

### Concurrent Requests

The server processes requests with controlled concurrency:

- **Batch Processing**: Multiple URLs fetched in batches of 3
- **Timeout Handling**: 30-second timeout for external requests
- **Error Recovery**: Failed requests don't block successful ones

### Optimization Tips

1. **Use Specific Sources**: Specify `sources` parameter to reduce search scope
2. **Set Appropriate Limits**: Use reasonable `limit` values to reduce response time
3. **Cache Awareness**: Repeated requests for same content will be served from cache
4. **Version Specificity**: Include version parameters when possible for better caching

---

## Security

### Input Validation

All inputs are validated and sanitized:

- **Query Length**: Maximum 1000 characters
- **XSS Prevention**: HTML and script tags are filtered
- **URL Validation**: Only HTTP/HTTPS URLs to public domains
- **Path Traversal**: Prevented in all file operations

### SSRF Protection

The server includes protection against Server-Side Request Forgery:

- **Private Networks**: Blocked access to localhost, 192.168.x.x, 10.x.x.x, 172.16-31.x.x
- **Protocol Restriction**: Only HTTP and HTTPS protocols allowed
- **Domain Validation**: URLs validated before requests

### Data Privacy

- **Sensitive Data**: Tokens and secrets are redacted from logs
- **Error Messages**: Internal details hidden from API responses
- **File Permissions**: Cache files created with restricted permissions (700)