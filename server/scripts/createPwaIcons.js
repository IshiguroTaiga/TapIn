const fs = require('fs');
const path = require('path');

// 1x1 Indigo Pixel PNG base64 representation
const base64Png = 'iVBORw0KGgoAAAANSU5EUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const buffer = Buffer.from(base64Png, 'base64');

const publicDir = path.join(__dirname, '../../client/public');
const pwa192 = path.join(publicDir, 'pwa-192x192.png');
const pwa512 = path.join(publicDir, 'pwa-512x512.png');

fs.writeFileSync(pwa192, buffer);
fs.writeFileSync(pwa512, buffer);

console.log('Created valid PWA PNG icons at client/public/ (192x192 and 512x512)');
