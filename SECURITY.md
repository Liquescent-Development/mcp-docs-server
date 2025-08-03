# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in the MCP Documentation Server, please report it responsibly:

1. **Do NOT** create a public GitHub issue
2. Email security reports to: [security@liquescent.dev](mailto:security@liquescent.dev)
3. Include as much detail as possible about the vulnerability
4. We will acknowledge your report within 48 hours

## Security Features

### Docker Security
- **Pinned Base Images**: Uses `node:20.19.4-alpine3.22` with security updates
- **Non-root Execution**: Runs as user `nodejs` (UID 1001)
- **Minimal Capabilities**: Only essential Linux capabilities enabled
- **Secret Management**: Docker secrets for sensitive configuration
- **Network Isolation**: Localhost-only binding by default

### Application Security  
- **SSRF Protection**: Blocks requests to private networks
- **Input Validation**: All inputs sanitized with Zod schemas
- **Error Handling**: Safe error messages without internal details
- **Secure Logging**: Sensitive data redacted from logs
- **Rate Limiting**: Configurable request rate limits

### File System Security
- **Path Traversal Protection**: Validates all file operations
- **Restricted Permissions**: Cache files created with 700 permissions
- **Directory Validation**: Prevents access to system directories

## Security Best Practices

### For Deployment

1. **Use Docker Secrets**:
   ```bash
   # Store GitHub tokens securely
   echo "your_token" > secrets/github_token.txt
   chmod 600 secrets/github_token.txt
   ```

2. **Bind to Localhost Only**:
   ```yaml
   # docker-compose.yml
   ports:
     - "127.0.0.1:3000:3000"  # Not "3000:3000"
   ```

3. **Regular Updates**:
   ```bash
   # Keep Docker images updated
   docker-compose pull
   docker-compose up -d
   ```

4. **Monitor Logs**:
   ```bash
   # Watch for security events
   docker-compose logs -f | grep -i "error\|security\|unauthorized"
   ```

### For Development

1. **Never Commit Secrets**:
   - Use `.env.example` templates
   - Add secrets to `.gitignore`
   - Use environment variables or Docker secrets

2. **Run Security Scans**:
   ```bash
   # Scan for vulnerabilities
   npm audit
   docker scout cves
   ```

3. **Update Dependencies**:
   ```bash
   # Keep packages current
   npm update
   npm audit fix
   ```

## Known Security Considerations

### Base Image Vulnerabilities
- **CVE-2025-27210**: Node.js path traversal (HIGH) - Monitor for patches
- **CVE-2025-23085**: HTTP/2 memory leak (MEDIUM) - Limited impact
- **CVE-2025-23165**: fs.ReadFileUtf8 corruption (LOW) - Minimal risk

### Mitigation Strategies
1. **Network Isolation**: Default localhost binding limits exposure
2. **Input Validation**: Comprehensive input sanitization
3. **Resource Limits**: CPU/memory constraints prevent DoS
4. **Health Monitoring**: Automated health checks detect issues

## Security Checklist

### Before Deployment
- [ ] GitHub token stored in Docker secrets (not environment)
- [ ] Ports bound to localhost only (`127.0.0.1:3000:3000`)
- [ ] Base images updated to latest secure versions
- [ ] Security context configured (`no-new-privileges:true`)
- [ ] Secrets directory excluded from git (`.gitignore`)
- [ ] File permissions set correctly (`chmod 600` for secrets)

### Production Security
- [ ] Regular security audits (`npm audit`, `docker scout`)
- [ ] Log monitoring for suspicious activity
- [ ] Network monitoring and intrusion detection
- [ ] Regular backup of cache data
- [ ] Incident response plan documented
- [ ] Security patches applied promptly

## Security Contacts

- **Security Team**: [security@liquescent.dev](mailto:security@liquescent.dev)
- **General Issues**: [GitHub Issues](https://github.com/Liquescent-Development/mcp-docs-server/issues)
- **Security Advisories**: [GitHub Security](https://github.com/Liquescent-Development/mcp-docs-server/security)

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | ✅ Yes              |
| < 1.0   | ❌ No               |

## Security Updates

We follow responsible disclosure and will:
1. Acknowledge security reports within 48 hours
2. Provide timeline for fixes within 7 days
3. Release security patches as soon as possible
4. Credit security researchers (with permission)

## Additional Resources

- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [OWASP Container Security](https://owasp.org/www-project-container-security/)
- [Alpine Linux Security](https://alpinelinux.org/posts/Alpine-Linux-security-audit.html)