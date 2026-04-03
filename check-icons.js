const fs = require('fs');
function checkType(filename) {
    const buffer = fs.readFileSync(filename).slice(0, 8);
    if (buffer.toString('hex').includes('89504e470d0a1a0a')) {
        console.log(`${filename}: image/png`);
    } else if (buffer.toString('hex').includes('ffd8ff')) {
        console.log(`${filename}: image/jpeg`);
    } else {
        console.log(`${filename}: unknown (${buffer.toString('hex')})`);
    }
}
checkType('icon-192x192.png');
checkType('icon-512x512.png');
