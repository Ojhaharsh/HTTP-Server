# Static HTTP Server

A minimal, production-ready HTTP server that serves static files from a configurable webroot.

## Features

- ✅ Serves static files with proper MIME types
- ✅ Supports HTTP GET and HEAD requests
- ✅ Directory traversal protection
- ✅ Conditional requests with `If-Modified-Since` (304 responses)
- ✅ HTTP caching with `Cache-Control` headers
- ✅ Request logging (timestamp, IP, method, path, status, bytes)
- ✅ Streaming file I/O (memory efficient)
- ✅ Proper HTTP status codes (200, 304, 403, 404, 405, 500)

## Requirements

- Node.js 18+ (uses built-in test runner and standard library only)

## Quick Start

```bash
# Install dependencies (none required - standard library only)
node server.js

# Or specify custom port and webroot
WEBROOT=./public PORT=8080 node server.js
```

The server will start on `http://localhost:8080` and serve files from `./public` directory.

## Configuration

Configure via environment variables:

- `PORT` - Server port (default: `8080`)
- `WEBROOT` - Root directory for static files (default: `./public`)

## Usage Examples

```bash
# Get the index page
curl http://localhost:8080/

# Get a CSS file
curl http://localhost:8080/style.css

# HEAD request (metadata only, no body)
curl -I http://localhost:8080/index.html

# Conditional request (returns 304 if not modified)
curl -H "If-Modified-Since: $(date -R)" http://localhost:8080/index.html

# Request a missing file (404)
curl http://localhost:8080/missing.html

# Try directory traversal (403 Forbidden)
curl http://localhost:8080/../etc/passwd
```

## Running Tests

```bash
node --test
```

Tests cover:
- ✅ 200 OK for existing files
- ✅ 404 Not Found for missing files
- ✅ 403 Forbidden for directory traversal attempts
- ✅ 405 Method Not Allowed for unsupported methods
- ✅ HEAD method behavior
- ✅ Correct Content-Type headers
- ✅ 304 Not Modified for conditional requests
- ✅ Cache-Control headers

## Docker

```bash
# Build the image
docker build -t static-http-server .

# Run the container
docker run -p 8080:8080 -v $(pwd)/public:/app/public static-http-server

# Or with custom webroot
docker run -p 8080:8080 -v /path/to/files:/app/public static-http-server
```