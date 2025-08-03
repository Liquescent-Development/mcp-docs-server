# Docker Deployment Guide

This guide explains how to deploy the MCP Documentation Server using Docker and Docker Compose.

## Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/Liquescent-Development/mcp-docs-server.git
cd mcp-docs-server
```

### 2. Configure environment
```bash
# Copy the example environment file
cp docker.env.example docker.env

# Edit docker.env with your configuration
# At minimum, ensure at least one documentation source URL is set
```

### 3. Build and run with Docker Compose
```bash
# Build and start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

The server will be available at `http://localhost:3000`.

## Configuration

### Environment Variables

All configuration is done through environment variables in `docker.env`:

```bash
# Documentation Sources (at least one required)
DOCS_ELECTRON_URL=https://www.electronjs.org
DOCS_REACT_URL=https://react.dev
DOCS_NODE_URL=https://nodejs.org
DOCS_GITHUB_URL=https://docs.github.com

# Optional: GitHub token for higher rate limits
GITHUB_TOKEN=ghp_your_token_here

# Server configuration
PORT=3000
NODE_ENV=production

# Caching
CACHE_TTL=3600
CACHE_STORAGE=both

# Performance
RATE_LIMIT_PER_MINUTE=60

# Logging
LOG_LEVEL=info
```

### Volumes

The Docker setup uses named volumes for persistence:

- `cache_data` - Documentation cache storage
- `log_data` - Application logs

### Health Checks

The container includes health checks that monitor the `/health` endpoint:

```bash
# Check container health
docker-compose ps

# Manual health check
curl http://localhost:3000/health
```

## Production Deployment

### Using Pre-built Image

Instead of building locally, you can use a pre-built image:

```yaml
# docker-compose.yml
services:
  mcp-docs-server:
    image: ghcr.io/liquescent-development/mcp-docs-server:latest
    # ... rest of configuration
```

### Resource Limits

The default docker-compose.yml includes resource limits:

- **CPU**: 2 cores limit, 0.5 cores reserved
- **Memory**: 2GB limit, 512MB reserved

Adjust these based on your needs:

```yaml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 4G
    reservations:
      cpus: '1'
      memory: 1G
```

### Scaling

For high availability, you can run multiple instances:

```bash
# Scale to 3 instances
docker-compose up -d --scale mcp-docs-server=3
```

Note: You'll need a load balancer to distribute traffic.

### Using with Reverse Proxy

Example nginx configuration:

```nginx
upstream mcp_docs {
    server localhost:3000;
}

server {
    listen 80;
    server_name docs.example.com;

    location / {
        proxy_pass http://mcp_docs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Optional Services

### Redis Cache

Uncomment the Redis service in docker-compose.yml for enhanced caching:

```yaml
redis:
  image: redis:7-alpine
  # ... configuration
```

Then set Redis URL in your environment:

```bash
REDIS_URL=redis://redis:6379
```

### PostgreSQL Database

Uncomment the PostgreSQL service for persistent storage:

```yaml
postgres:
  image: postgres:16-alpine
  # ... configuration
```

Configure database connection:

```bash
DB_USER=mcp
DB_PASSWORD=your_secure_password
DATABASE_URL=postgresql://mcp:your_secure_password@postgres:5432/mcp_docs
```

## Troubleshooting

### Container won't start

Check logs:
```bash
docker-compose logs mcp-docs-server
```

Common issues:
- Missing environment variables
- Port already in use
- Insufficient resources

### Health check failing

Test the health endpoint:
```bash
docker exec mcp-docs-server curl http://localhost:3000/health
```

### Permission errors

Ensure proper ownership:
```bash
docker exec mcp-docs-server ls -la /app/cache /app/logs
```

### Performance issues

Monitor resource usage:
```bash
docker stats mcp-docs-server
```

Consider:
- Increasing resource limits
- Enabling Redis cache
- Adjusting cache TTL

## Backup and Restore

### Backup cache data

```bash
# Backup cache volume
docker run --rm -v mcp-docs-server_cache_data:/data -v $(pwd):/backup alpine tar czf /backup/cache-backup.tar.gz -C /data .

# Backup logs
docker run --rm -v mcp-docs-server_log_data:/data -v $(pwd):/backup alpine tar czf /backup/logs-backup.tar.gz -C /data .
```

### Restore from backup

```bash
# Restore cache
docker run --rm -v mcp-docs-server_cache_data:/data -v $(pwd):/backup alpine tar xzf /backup/cache-backup.tar.gz -C /data

# Restore logs
docker run --rm -v mcp-docs-server_log_data:/data -v $(pwd):/backup alpine tar xzf /backup/logs-backup.tar.gz -C /data
```

## Security Considerations

1. **Use secrets for sensitive data**: Don't commit `.env` files with tokens
2. **Run as non-root**: The container runs as user `nodejs` (UID 1001)
3. **Network isolation**: Uses a dedicated bridge network
4. **Resource limits**: Prevents resource exhaustion
5. **Health checks**: Ensures service availability

## Monitoring

### Prometheus metrics (future feature)

The server will expose metrics at `/metrics`:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'mcp-docs'
    static_configs:
      - targets: ['mcp-docs-server:3000']
```

### Log aggregation

Forward logs to a centralized system:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

Or use a log driver:

```yaml
logging:
  driver: "syslog"
  options:
    syslog-address: "tcp://logserver:514"
```