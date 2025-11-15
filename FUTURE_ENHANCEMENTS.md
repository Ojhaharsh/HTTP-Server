# Future Enhancements

This document outlines suggested next steps and enhancements for the Static HTTP Server project.

## High Priority

### 1. Compression Support (gzip/Brotli)
**Complexity:** Medium | **Impact:** High

Add automatic compression for text-based resources to reduce bandwidth usage.

**Implementation approach:**
- Check `Accept-Encoding` header for `gzip` or `br` support
- Compress responses on-the-fly using Node.js `zlib` module
- Add `Content-Encoding` header to response
- Consider caching compressed versions for better performance

```javascript
const zlib = require('zlib');

// In serveFile function:
if (req.headers['accept-encoding']?.includes('gzip')) {
  res.setHeader('Content-Encoding', 'gzip');
  pipeline(readStream, zlib.createGzip(), res, callback);
}
```

**Benefits:**
- 60-80% reduction in text file sizes
- Faster page loads for clients
- Lower bandwidth costs

---

### 2. HTTP Range Requests (Partial Content)
**Complexity:** Medium | **Impact:** Medium

Support `Range` header for resumable downloads and video streaming.

**Implementation approach:**
- Parse `Range: bytes=start-end` header
- Read only requested byte range from file
- Return 206 Partial Content with `Content-Range` header
- Support multiple ranges (multipart/byteranges)

```javascript
const range = req.headers.range;
if (range) {
  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
  
  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': end - start + 1,
  });
  
  fs.createReadStream(filePath, { start, end }).pipe(res);
}
```

**Benefits:**
- Resumable downloads
- Video/audio seeking in browsers
- Better mobile experience

---

### 3. ETag Support
**Complexity:** Low | **Impact:** Medium

Generate ETags for more robust caching validation.

**Implementation approach:**
- Generate ETag from file stats (mtime + size) or content hash
- Support `If-None-Match` header
- Return 304 when ETag matches

```javascript
const etag = `"${stats.mtime.getTime()}-${stats.size}"`;
res.setHeader('ETag', etag);

if (req.headers['if-none-match'] === etag) {
  res.writeHead(304);
  return res.end();
}
```

**Benefits:**
- More accurate cache validation
- Works with CDNs and proxies
- Standard HTTP caching mechanism

---

## Medium Priority

### 4. TLS/HTTPS Support
**Complexity:** Low-Medium | **Impact:** High (for production)

**Option A: Direct HTTPS (Node.js)**
```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('privkey.pem'),
  cert: fs.readFileSync('cert.pem'),
};

https.createServer(options, handleRequest).listen(443);
```

**Option B: Reverse Proxy (Recommended)**
Use nginx or Caddy for TLS termination:
```nginx
server {
  listen 443 ssl;
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  
  location / {
    proxy_pass http://localhost:8080;
  }
}
```

**Benefits:**
- Encrypted connections
- Required for production use
- Reverse proxy handles TLS efficiently

---

### 5. Graceful Shutdown
**Complexity:** Low | **Impact:** Low

Improve shutdown handling to wait for in-flight requests.

```javascript
let isShuttingDown = false;

process.on('SIGTERM', () => {
  isShuttingDown = true;
  server.close(() => {
    console.log('All connections closed');
    process.exit(0);
  });
  
  // Force shutdown after timeout
  setTimeout(() => {
    console.error('Forcing shutdown');
    process.exit(1);
  }, 10000);
});

// Reject new requests during shutdown
if (isShuttingDown) {
  res.writeHead(503, { 'Connection': 'close' });
  return res.end('Server is shutting down');
}
```

---

### 6. Custom 404/Error Pages
**Complexity:** Low | **Impact:** Low

Serve custom HTML pages for errors instead of plain text.

```javascript
function sendErrorPage(res, statusCode, req) {
  const errorPagePath = path.join(WEBROOT, `${statusCode}.html`);
  
  fs.stat(errorPagePath, (err) => {
    if (!err) {
      // Serve custom error page
      return serveFile(errorPagePath, req, res);
    }
    
    // Fallback to default error
    sendError(res, statusCode, req);
  });
}
```

---

## Low Priority / Nice to Have

### 7. Directory Listing
**Complexity:** Medium | **Impact:** Low

Generate HTML directory listings when no index.html exists (opt-in).

```javascript
fs.readdir(dirPath, (err, files) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>Index of ${pathname}</h1>
        <ul>
          ${files.map(f => `<li><a href="${f}">${f}</a></li>`).join('')}
        </ul>
      </body>
    </html>
  `;
  
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});
```

---

### 8. Request Rate Limiting
**Complexity:** Medium | **Impact:** Medium

Prevent abuse by limiting requests per IP.

```javascript
const rateLimits = new Map(); // ip -> { count, resetTime }

function checkRateLimit(ip) {
  const limit = rateLimits.get(ip);
  const now = Date.now();
  
  if (!limit || now > limit.resetTime) {
    rateLimits.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }
  
  if (limit.count >= 100) { // 100 requests per minute
    return false;
  }
  
  limit.count++;
  return true;
}
```

---

### 9. Configuration File
**Complexity:** Low | **Impact:** Low

Support JSON/YAML config file instead of only env vars.

```javascript
// config.json
{
  "port": 8080,
  "webroot": "./public",
  "cacheMaxAge": 60,
  "compression": true,
  "mimeTypes": {
    ".custom": "application/x-custom"
  }
}
```

---

### 10. Access Logs to File
**Complexity:** Low | **Impact:** Low

Write logs to rotating log files.

```javascript
const fs = require('fs');
const logStream = fs.createWriteStream('access.log', { flags: 'a' });

function logRequest(req, statusCode, bytesSent) {
  const logLine = `${new Date().toISOString()} | ${req.socket.remoteAddress} | ${req.method} | ${req.url} | ${statusCode} | ${bytesSent}\n`;
  logStream.write(logLine);
  console.log(logLine.trim());
}
```

---

## Performance Optimizations

### 11. In-Memory Caching
Cache frequently accessed small files in memory.

### 12. Cluster Mode
Use Node.js cluster module to utilize multiple CPU cores.

### 13. Static Asset Fingerprinting
Support cache-busting with file hashes in URLs.

---

## Testing Improvements

### 14. Load Testing
Add performance benchmarks with `autocannon` or `wrk`.

### 15. Security Testing
Add OWASP ZAP or similar security scanning.

### 16. E2E Tests
Browser-based tests with Playwright/Puppeteer.

---

## Implementation Priority

**Phase 1 (Essential for production):**
1. TLS/HTTPS support (via reverse proxy)
2. Compression (gzip/Brotli)
3. Graceful shutdown
4. ETag support

**Phase 2 (Nice performance wins):**
5. HTTP Range requests
6. Custom error pages
7. Configuration file
8. Rate limiting

**Phase 3 (Advanced features):**
9. Directory listing (opt-in)
10. Cluster mode
11. In-memory caching
12. Access logs to file

---

## Contributing

When implementing these features:
1. Add tests for new functionality
2. Update README with new configuration options
3. Maintain backward compatibility
4. Keep dependencies minimal (prefer standard library)
5. Document breaking changes in commit messages

---

## Performance Targets

Current performance (baseline):
- Requests/second: ~10,000 (single core)
- Latency p50: <1ms (local)
- Memory usage: ~20MB (idle)

After optimizations:
- Requests/second: ~50,000+ (with compression + cluster)
- Latency p50: <1ms
- Memory usage: ~50MB per worker

---

## Security Enhancements

### Additional Security Considerations
- **CSP Headers**: Add Content-Security-Policy headers
- **CORS**: Support configurable CORS policies
- **Request Size Limits**: Prevent large header attacks
- **Timeout Controls**: Configure request timeouts
- **IP Whitelisting**: Restrict access by IP address

---

*Last updated: 2025-11-15*
