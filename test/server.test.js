const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_PORT = 9999;
const TEST_WEBROOT = path.join(__dirname, 'test-files');

// Import server (will use for starting test instance)
let server;

/**
 * Make HTTP request helper
 */
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: 'localhost',
      port: TEST_PORT,
      ...options,
    };
    
    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Setup test environment
 */
before(async () => {
  // Create test files directory
  if (!fs.existsSync(TEST_WEBROOT)) {
    fs.mkdirSync(TEST_WEBROOT, { recursive: true });
  }

  // Create test files
  fs.writeFileSync(
    path.join(TEST_WEBROOT, 'test.html'),
    '<html><body>Test HTML</body></html>'
  );
  fs.writeFileSync(
    path.join(TEST_WEBROOT, 'test.css'),
    'body { color: red; }'
  );
  fs.writeFileSync(
    path.join(TEST_WEBROOT, 'test.txt'),
    'Plain text file'
  );
  fs.writeFileSync(
    path.join(TEST_WEBROOT, 'index.html'),
    '<html><body>Index</body></html>'
  );

  // Create subdirectory with index.html
  const subDir = path.join(TEST_WEBROOT, 'subdir');
  if (!fs.existsSync(subDir)) {
    fs.mkdirSync(subDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(subDir, 'index.html'),
    '<html><body>Subdir Index</body></html>'
  );

  // Create subdirectory without index.html
  const emptyDir = path.join(TEST_WEBROOT, 'empty');
  if (!fs.existsSync(emptyDir)) {
    fs.mkdirSync(emptyDir, { recursive: true });
  }

  // Start test server
  process.env.WEBROOT = TEST_WEBROOT;
  process.env.PORT = TEST_PORT;

  // Create server instance
  const http = require('http');
  const { handleRequest } = require('../server.js');
  
  server = http.createServer(handleRequest);
  
  await new Promise((resolve) => {
    server.listen(TEST_PORT, () => {
      console.log(`Test server started on port ${TEST_PORT}`);
      resolve();
    });
  });
});

/**
 * Cleanup test environment
 */
after(async () => {
  // Stop server
  if (server) {
    await new Promise((resolve) => {
      server.close(() => {
        console.log('Test server stopped');
        resolve();
      });
    });
  }

  // Clean up test files
  if (fs.existsSync(TEST_WEBROOT)) {
    fs.rmSync(TEST_WEBROOT, { recursive: true, force: true });
  }
});

// Test suites
describe('HTTP Server Tests', () => {
  
  describe('Basic file serving', () => {
    test('should return 200 for existing HTML file', async () => {
      const res = await makeRequest({
        path: '/test.html',
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['content-type'], 'text/html');
      assert(res.body.includes('Test HTML'));
    });

    test('should return 200 for existing CSS file', async () => {
      const res = await makeRequest({
        path: '/test.css',
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['content-type'], 'text/css');
      assert(res.body.includes('color: red'));
    });

    test('should return 200 for existing TXT file', async () => {
      const res = await makeRequest({
        path: '/test.txt',
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['content-type'], 'text/plain');
      assert(res.body.includes('Plain text file'));
    });

    test('should return correct Content-Length header', async () => {
      const res = await makeRequest({
        path: '/test.txt',
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 200);
      assert(res.headers['content-length']);
      assert.strictEqual(parseInt(res.headers['content-length']), res.body.length);
    });
  });

  describe('Directory handling', () => {
    test('should serve index.html for root directory', async () => {
      const res = await makeRequest({
        path: '/',
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 200);
      assert(res.body.includes('Index'));
    });

    test('should serve index.html for subdirectory', async () => {
      const res = await makeRequest({
        path: '/subdir/',
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 200);
      assert(res.body.includes('Subdir Index'));
    });

    test('should return 403 for directory without index.html', async () => {
      const res = await makeRequest({
        path: '/empty/',
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 403);
    });
  });

  describe('Error handling', () => {
    test('should return 404 for non-existent file', async () => {
      const res = await makeRequest({
        path: '/does-not-exist.html',
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 404);
      assert(res.body.includes('404'));
    });

    test('should return 404 for non-existent path', async () => {
      const res = await makeRequest({
        path: '/fake/path/file.txt',
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 404);
    });
  });

  describe('HTTP methods', () => {
    test('should return 405 for POST request', async () => {
      const res = await makeRequest({
        path: '/test.html',
        method: 'POST',
      });
      
      assert.strictEqual(res.statusCode, 405);
      assert.strictEqual(res.headers['allow'], 'GET, HEAD');
    });

    test('should return 405 for PUT request', async () => {
      const res = await makeRequest({
        path: '/test.html',
        method: 'PUT',
      });
      
      assert.strictEqual(res.statusCode, 405);
      assert.strictEqual(res.headers['allow'], 'GET, HEAD');
    });

    test('should return 405 for DELETE request', async () => {
      const res = await makeRequest({
        path: '/test.html',
        method: 'DELETE',
      });
      
      assert.strictEqual(res.statusCode, 405);
      assert.strictEqual(res.headers['allow'], 'GET, HEAD');
    });
  });

  describe('HEAD method', () => {
    test('should support HEAD requests', async () => {
      const res = await makeRequest({
        path: '/test.html',
        method: 'HEAD',
      });
      
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body, ''); // No body for HEAD
    });

    test('should return same headers as GET (including Content-Length)', async () => {
      const getRes = await makeRequest({
        path: '/test.html',
        method: 'GET',
      });
      
      const headRes = await makeRequest({
        path: '/test.html',
        method: 'HEAD',
      });
      
      assert.strictEqual(headRes.statusCode, 200);
      assert.strictEqual(headRes.headers['content-type'], getRes.headers['content-type']);
      assert.strictEqual(headRes.headers['content-length'], getRes.headers['content-length']);
      assert.strictEqual(headRes.headers['last-modified'], getRes.headers['last-modified']);
      assert.strictEqual(headRes.headers['cache-control'], getRes.headers['cache-control']);
    });

    test('should return correct Content-Length for HEAD request', async () => {
      const headRes = await makeRequest({
        path: '/test.txt',
        method: 'HEAD',
      });
      
      const getRes = await makeRequest({
        path: '/test.txt',
        method: 'GET',
      });
      
      assert.strictEqual(headRes.statusCode, 200);
      assert.strictEqual(headRes.body, '');
      assert.strictEqual(headRes.headers['content-length'], getRes.headers['content-length']);
      assert.strictEqual(parseInt(headRes.headers['content-length']), getRes.body.length);
    });

    test('should return 404 for HEAD on missing file', async () => {
      const res = await makeRequest({
        path: '/missing.html',
        method: 'HEAD',
      });
      
      assert.strictEqual(res.statusCode, 404);
    });

    test('should support conditional HEAD with If-Modified-Since', async () => {
      // Get Last-Modified first
      const firstRes = await makeRequest({
        path: '/test.html',
        method: 'HEAD',
      });
      
      const lastModified = firstRes.headers['last-modified'];
      
      // HEAD with If-Modified-Since
      const res = await makeRequest({
        path: '/test.html',
        method: 'HEAD',
        headers: {
          'If-Modified-Since': lastModified,
        },
      });
      
      assert.strictEqual(res.statusCode, 304);
      assert.strictEqual(res.body, '');
    });
  });

  describe('MIME types', () => {
    test('should return correct Content-Type for HTML', async () => {
      const res = await makeRequest({
        path: '/test.html',
        method: 'GET',
      });
      
      assert.strictEqual(res.headers['content-type'], 'text/html');
    });

    test('should return correct Content-Type for CSS', async () => {
      const res = await makeRequest({
        path: '/test.css',
        method: 'GET',
      });
      
      assert.strictEqual(res.headers['content-type'], 'text/css');
    });

    test('should return correct Content-Type for TXT', async () => {
      const res = await makeRequest({
        path: '/test.txt',
        method: 'GET',
      });
      
      assert.strictEqual(res.headers['content-type'], 'text/plain');
    });
  });

  describe('Security - Path Traversal Protection', () => {
    test('should return 403 for path with .. traversal', async () => {
      const res = await makeRequest({
        path: '/../etc/passwd',
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 403);
    });

    test('should return 403 for encoded .. traversal (%2e%2e)', async () => {
      const res = await makeRequest({
        path: '/%2e%2e/etc/passwd',
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 403);
    });

    test('should return 403 for multiple .. segments', async () => {
      const res = await makeRequest({
        path: '/../../etc/passwd',
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 403);
    });

    test('should return 403 for .. in middle of path', async () => {
      const res = await makeRequest({
        path: '/subdir/../../etc/passwd',
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 403);
    });

    test('should return 403 for Windows-style path traversal', async () => {
      const res = await makeRequest({
        path: '/..\\..\\windows\\system32\\config\\sam',
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 403);
    });

    test('should allow legitimate paths with dots in filename', async () => {
      // Create a file with dots in name
      fs.writeFileSync(
        path.join(TEST_WEBROOT, 'file.test.txt'),
        'test content'
      );

      const res = await makeRequest({
        path: '/file.test.txt',
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 200);
      assert(res.body.includes('test content'));
    });

    test('should normalize paths correctly for valid requests', async () => {
      const res = await makeRequest({
        path: '/./test.html', // ./ should be normalized
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 200);
    });

    test('should block null bytes in path', async () => {
      const res = await makeRequest({
        path: '/test.html%00.txt',
        method: 'GET',
      });
      
      // Should be 404 or 403, depending on how URL decoding handles it
      assert(res.statusCode === 403 || res.statusCode === 404);
    });
  });

  describe('Response headers', () => {
    test('should include Last-Modified header', async () => {
      const res = await makeRequest({
        path: '/test.html',
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 200);
      assert(res.headers['last-modified']);
      // Verify it's a valid date
      const date = new Date(res.headers['last-modified']);
      assert(date instanceof Date && !isNaN(date));
    });

    test('should include Cache-Control header', async () => {
      const res = await makeRequest({
        path: '/test.html',
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['cache-control'], 'public, max-age=60');
    });
  });

  describe('Conditional requests (caching)', () => {
    test('should return 304 if If-Modified-Since matches Last-Modified', async () => {
      // First request to get Last-Modified
      const firstRes = await makeRequest({
        path: '/test.html',
        method: 'GET',
      });
      
      assert.strictEqual(firstRes.statusCode, 200);
      const lastModified = firstRes.headers['last-modified'];
      assert(lastModified);

      // Second request with If-Modified-Since
      const secondRes = await makeRequest({
        path: '/test.html',
        method: 'GET',
        headers: {
          'If-Modified-Since': lastModified,
        },
      });
      
      assert.strictEqual(secondRes.statusCode, 304);
      assert.strictEqual(secondRes.body, ''); // No body for 304
      assert(secondRes.headers['last-modified']);
      assert.strictEqual(secondRes.headers['cache-control'], 'public, max-age=60');
    });

    test('should return 304 if file not modified since date', async () => {
      // Use a future date
      const futureDate = new Date(Date.now() + 86400000).toUTCString(); // +1 day
      
      const res = await makeRequest({
        path: '/test.html',
        method: 'GET',
        headers: {
          'If-Modified-Since': futureDate,
        },
      });
      
      assert.strictEqual(res.statusCode, 304);
      assert.strictEqual(res.body, '');
    });

    test('should return 200 if file modified after If-Modified-Since date', async () => {
      // Use a date in the past
      const pastDate = new Date(0).toUTCString(); // Unix epoch
      
      const res = await makeRequest({
        path: '/test.html',
        method: 'GET',
        headers: {
          'If-Modified-Since': pastDate,
        },
      });
      
      assert.strictEqual(res.statusCode, 200);
      assert(res.body.length > 0); // Should have body
    });

    test('should return 200 if no If-Modified-Since header', async () => {
      const res = await makeRequest({
        path: '/test.html',
        method: 'GET',
      });
      
      assert.strictEqual(res.statusCode, 200);
      assert(res.body.length > 0);
    });
  });
});
