'use strict';

// A dependency-free preview server with the same config handler used on Vercel.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../api/config.js');
const root = path.resolve(__dirname, '..');
const assets = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'application/javascript; charset=utf-8'],
  '/auth.js': ['auth.js', 'application/javascript; charset=utf-8']
};

http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (pathname === '/api/config') {
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (value) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(value)); };
    return config(req, res);
  }
  const asset = Object.hasOwn(assets, pathname) && assets[pathname];
  if (!asset || !['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(404);
    return res.end('Not found');
  }
  res.setHeader('Content-Type', asset[1]);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(path.join(root, asset[0])).pipe(res);
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
