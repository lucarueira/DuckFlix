// Deterministic ZIP (stored entries), no external packaging dependencies.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'chrome-extension/manifest.json'))).version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid extension version');
const names = ['manifest.json', 'policy.js', 'background.js', 'content.js', 'popup.html', 'popup.css', 'popup.js', 'LEIA-ME.txt'];
function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ -1) >>> 0;
}
const entries = [], central = []; let offset = 0;
for (const name of names) {
  const filename = Buffer.from(`duckflix-http/${name}`), data = fs.readFileSync(path.join(root, 'chrome-extension', name));
  const crc = crc32(data), header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6); header.writeUInt16LE(33, 12);
  header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(filename.length, 26);
  entries.push(header, filename, data);
  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(0x800, 8); directory.writeUInt16LE(33, 14);
  directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(data.length, 24); directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42);
  central.push(directory, filename); offset += header.length + filename.length + data.length;
}
const directory = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
fs.mkdirSync(path.join(root, 'downloads'), { recursive: true });
const target = path.join(root, 'downloads', `duckflix-http-${version}.zip`);
fs.writeFileSync(target, Buffer.concat([...entries, directory, end]));
console.log(target);
