const http = require('http');
const fs = require('fs');
const path = require('path');
const types = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml'
};
http.createServer((req, res) => {
    let fp = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(fp);
    fs.readFile(fp, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
        res.end(data);
    });
}).listen(8080, () => console.log('Server running on http://localhost:8080'));
