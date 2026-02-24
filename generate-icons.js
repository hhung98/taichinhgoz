// Generate proper PNG icons for PWA manifest
const fs = require('fs');
const http = require('https');

// Download a simple finance icon as proper PNG from a public source
function downloadIcon(size, filename) {
    return new Promise((resolve, reject) => {
        // Use UI Avatars API to generate a simple icon
        const url = `https://ui-avatars.com/api/?name=%F0%9F%92%B0&size=${size}&background=0f0f1a&color=ffd93d&format=png&bold=true&font-size=0.5`;
        const file = fs.createWriteStream(filename);
        http.get(url, (res) => {
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`Created ${filename} (${size}x${size})`);
                resolve();
            });
        }).on('error', (e) => {
            fs.unlink(filename, () => { });
            reject(e);
        });
    });
}

async function main() {
    await downloadIcon(512, 'icon-512x512.png');
    await downloadIcon(192, 'icon-192x192.png');
    console.log('Done!');
}

main().catch(console.error);
