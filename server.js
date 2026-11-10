const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5500;

const types = {
    '.html': 'text/html; charset=utf-8', 
    '.css': 'text/css; charset=utf-8', 
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', 
    '.png': 'image/png', 
    '.svg': 'image/svg+xml; charset=utf-8',
    '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
    // 1. Yahoo Finance Realtime Proxy (Matching APP JINIL proxy pattern)
    if (req.url.startsWith('/api/yahoo/')) {
        const symbolPath = req.url.replace('/api/yahoo/', '');
        const targetUrl = 'https://query2.finance.yahoo.com/v8/finance/chart/' + symbolPath;
        
        https.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            }
        }, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            proxyRes.pipe(res);
        }).on('error', (e) => {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: e.message }));
        });
        return;
    }

    // 2. Static File Serving
    const cleanUrl = req.url.split('?')[0];
    let fp = path.join(__dirname, cleanUrl === '/' ? 'index.html' : cleanUrl);
    const ext = path.extname(fp).toLowerCase();
    
    fs.readFile(fp, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
        }
        res.writeHead(200, {
            'Content-Type': types[ext] || 'application/octet-stream',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(data);
    });
}).listen(PORT, () => {
    console.log(`GOZ PRO Server running on http://localhost:${PORT}`);
});
