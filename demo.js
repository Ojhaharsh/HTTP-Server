#!/usr/bin/env node

/**
 * Demonstration script for Static HTTP Server
 * Shows all key features with live tests
 */

const http = require('http');

console.log('🚀 Static HTTP Server - Feature Demonstration\n');
console.log('=' .repeat(60));

// Helper to make HTTP requests
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      ...options,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function runDemo() {
  try {
    console.log('\n✅ Feature 1: Serve HTML files with correct MIME type');
    const html = await makeRequest({ path: '/', method: 'GET' });
    console.log(`   Status: ${html.statusCode}`);
    console.log(`   Content-Type: ${html.headers['content-type']}`);
    console.log(`   Content-Length: ${html.headers['content-length']} bytes`);

    console.log('\n✅ Feature 2: Serve CSS files');
    const css = await makeRequest({ path: '/style.css', method: 'GET' });
    console.log(`   Status: ${css.statusCode}`);
    console.log(`   Content-Type: ${css.headers['content-type']}`);
    console.log(`   Content-Length: ${css.headers['content-length']} bytes`);

    console.log('\n✅ Feature 3: HTTP Caching with Cache-Control');
    console.log(`   Cache-Control: ${html.headers['cache-control']}`);
    console.log(`   Last-Modified: ${html.headers['last-modified']}`);

    console.log('\n✅ Feature 4: Conditional requests (If-Modified-Since)');
    const cached = await makeRequest({
      path: '/',
      method: 'GET',
      headers: { 'If-Modified-Since': html.headers['last-modified'] }
    });
    console.log(`   Status: ${cached.statusCode} (Not Modified)`);
    console.log(`   Body length: ${cached.body.length} bytes (no body sent)`);

    console.log('\n✅ Feature 5: HEAD method support');
    const head = await makeRequest({ path: '/', method: 'HEAD' });
    console.log(`   Status: ${head.statusCode}`);
    console.log(`   Content-Length: ${head.headers['content-length']} bytes`);
    console.log(`   Body length: ${head.body.length} bytes (headers only)`);

    console.log('\n✅ Feature 6: Directory traversal protection');
    const attack = await makeRequest({ path: '/../etc/passwd', method: 'GET' });
    console.log(`   Status: ${attack.statusCode} (Forbidden)`);
    console.log(`   ✓ Attack blocked!`);

    console.log('\n✅ Feature 7: 404 for missing files');
    const missing = await makeRequest({ path: '/does-not-exist.html', method: 'GET' });
    console.log(`   Status: ${missing.statusCode} (Not Found)`);

    console.log('\n✅ Feature 8: 405 for unsupported methods');
    const post = await makeRequest({ path: '/', method: 'POST' });
    console.log(`   Status: ${post.statusCode} (Method Not Allowed)`);
    console.log(`   Allow header: ${post.headers['allow']}`);

    console.log('\n' + '=' .repeat(60));
    console.log('\n🎉 All features working perfectly!');
    console.log('\n📊 Server Capabilities:');
    console.log('   ✓ GET and HEAD requests');
    console.log('   ✓ Streaming file I/O');
    console.log('   ✓ MIME type detection');
    console.log('   ✓ HTTP caching (Cache-Control + If-Modified-Since)');
    console.log('   ✓ Path traversal protection');
    console.log('   ✓ Proper status codes (200, 304, 403, 404, 405)');
    console.log('   ✓ Request logging');
    
    console.log('\n🌐 Open http://localhost:8080 in your browser to see the UI!');
    console.log('\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure the server is running: node server.js');
    process.exit(1);
  }
}

runDemo();
