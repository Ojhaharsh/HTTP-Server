#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');

// Configuration from environment
const PORT = process.env.PORT || 8080;
const WEBROOT = path.resolve(process.env.WEBROOT || './public');

// MIME type mapping (standard types)
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};

/**
 * Log request in a structured format
 * Format: timestamp | remote_ip | method | path | status | bytes_sent
 */
function logRequest(req, statusCode, bytesSent) {
  const timestamp = new Date().toISOString();
  const ip = req.socket.remoteAddress;
  const method = req.method;
  const url = req.url;
  console.log(`${timestamp} | ${ip} | ${method} | ${url} | ${statusCode} | ${bytesSent}`);
}

/**
 * Send error response with appropriate status code
 */
function sendError(res, statusCode, message, req) {
  const body = `${statusCode} ${message}\n`;
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
  logRequest(req, statusCode, Buffer.byteLength(body));
}

/**
 * Check if requested path is within WEBROOT (prevent directory traversal)
 * This function normalizes the path and ensures it stays within WEBROOT
 */
function isPathSafe(requestedPath) {
  // Normalize the path to resolve any .. or . segments
  const normalized = path.normalize(requestedPath);
  const resolved = path.resolve(normalized);
  const webroot = path.resolve(WEBROOT);
  
  // Check if the resolved path starts with the webroot
  // This prevents directory traversal attacks
  return resolved.startsWith(webroot);
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Handle HTTP request
 */
function handleRequest(req, res) {
  // Support GET and HEAD requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, {
      'Allow': 'GET, HEAD',
      'Content-Type': 'text/plain',
    });
    res.end('405 Method Not Allowed\n');
    logRequest(req, 405, 24);
    return;
  }

  // Check raw URL for suspicious patterns BEFORE URL parsing
  // (URL constructor normalizes paths, removing ..)
  const rawUrl = req.url || '';
  if (rawUrl.includes('..') || rawUrl.includes('%2e%2e') || rawUrl.includes('%2E%2E')) {
    return sendError(res, 403, 'Forbidden', req);
  }

  // Decode URL and extract pathname (handle URL encoding safely)
  let pathname;
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    // decodeURIComponent is already called by URL constructor for pathname
    pathname = url.pathname;
  } catch (err) {
    return sendError(res, 400, 'Bad Request', req);
  }

  // Normalize path
  pathname = path.normalize(pathname);

  // Map URL path to filesystem path
  let filePath = path.join(WEBROOT, pathname);

  // Final security check - ensure resolved path is within WEBROOT
  if (!isPathSafe(filePath)) {
    return sendError(res, 403, 'Forbidden', req);
  }

  // Check if path exists
  fs.stat(filePath, (err, stats) => {
    if (err) {
      if (err.code === 'ENOENT') {
        return sendError(res, 404, 'Not Found', req);
      }
      return sendError(res, 500, 'Internal Server Error', req);
    }

    // If directory, try to serve index.html
    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      
      fs.stat(filePath, (err, indexStats) => {
        if (err) {
          // No index.html found - return 403 Forbidden
          // Choice: 403 instead of 404 because the directory exists but access is not allowed
          // This prevents information disclosure about directory structure
          return sendError(res, 403, 'Forbidden', req);
        }
        
        serveFile(filePath, indexStats, req, res);
      });
    } else {
      serveFile(filePath, stats, req, res);
    }
  });
}

/**
 * Serve a file with streaming
 */
function serveFile(filePath, stats, req, res) {
  const mimeType = getMimeType(filePath);
  const fileSize = stats.size;
  const lastModified = stats.mtime.toUTCString();

  // Check If-Modified-Since header for conditional requests
  const ifModifiedSince = req.headers['if-modified-since'];
  if (ifModifiedSince) {
    const ifModifiedSinceDate = new Date(ifModifiedSince);
    const lastModifiedDate = new Date(lastModified);
    
    // If file hasn't been modified, return 304 Not Modified
    if (lastModifiedDate <= ifModifiedSinceDate) {
      res.writeHead(304, {
        'Last-Modified': lastModified,
        'Cache-Control': 'public, max-age=60',
      });
      res.end();
      logRequest(req, 304, 0);
      return;
    }
  }

  // Set response headers with caching
  res.writeHead(200, {
    'Content-Type': mimeType,
    'Content-Length': fileSize,
    'Last-Modified': lastModified,
    'Cache-Control': 'public, max-age=60', // Cache for 60 seconds
  });

  // For HEAD requests, only send headers (no body)
  if (req.method === 'HEAD') {
    res.end();
    logRequest(req, 200, 0);
    return;
  }

  // Stream file to response for GET requests (memory efficient)
  const readStream = fs.createReadStream(filePath);
  let bytesSent = 0;

  // Track bytes sent for logging
  readStream.on('data', (chunk) => {
    bytesSent += chunk.length;
  });

  readStream.on('end', () => {
    logRequest(req, 200, bytesSent);
  });

  readStream.on('error', (err) => {
    console.error('Stream error:', err);
    logRequest(req, 500, 0);
  });

  // Use pipeline for proper error handling and backpressure
  pipeline(readStream, res, (err) => {
    if (err) {
      console.error('Pipeline error:', err);
    }
  });
}

// Create server
const server = http.createServer(handleRequest);

// Only start server if this file is run directly (not required as module)
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Static HTTP Server running on http://localhost:${PORT}`);
    console.log(`Serving files from: ${WEBROOT}`);
    console.log(`Press Ctrl+C to stop`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

module.exports = { server, handleRequest };
