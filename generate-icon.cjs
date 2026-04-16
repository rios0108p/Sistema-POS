const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, 'src', 'assets', 'ICONO.png');
const BUILD_DIR = path.join(__dirname, 'build');
const SIZES = [16, 32, 48, 64, 128, 256];

// Manual ICO file generator (no external dependency needed)
function createIco(pngBuffers, sizes) {
  // ICO file format:
  // ICONDIR (6 bytes) + ICONDIRENTRY * n (16 bytes each) + PNG data
  const numImages = pngBuffers.length;
  const headerSize = 6 + (numImages * 16);
  
  // Calculate offsets for each image
  let currentOffset = headerSize;
  const offsets = [];
  for (const buf of pngBuffers) {
    offsets.push(currentOffset);
    currentOffset += buf.length;
  }
  
  // Build header (ICONDIR)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);         // Reserved
  header.writeUInt16LE(1, 2);         // Type: 1 = ICO
  header.writeUInt16LE(numImages, 4); // Number of images
  
  // Build directory entries (ICONDIRENTRY)
  const entries = [];
  for (let i = 0; i < numImages; i++) {
    const entry = Buffer.alloc(16);
    const size = sizes[i];
    entry.writeUInt8(size >= 256 ? 0 : size, 0);  // Width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1);  // Height (0 = 256)
    entry.writeUInt8(0, 2);                         // Color palette
    entry.writeUInt8(0, 3);                         // Reserved
    entry.writeUInt16LE(1, 4);                      // Color planes
    entry.writeUInt16LE(32, 6);                     // Bits per pixel
    entry.writeUInt32LE(pngBuffers[i].length, 8);   // Size of image data
    entry.writeUInt32LE(offsets[i], 12);             // Offset to image data
    entries.push(entry);
  }
  
  return Buffer.concat([header, ...entries, ...pngBuffers]);
}

async function generateIcons() {
  console.log('🎨 Generating icons from:', SOURCE);
  
  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
  }

  // Generate PNG buffers for each size
  const pngBuffers = [];
  for (const size of SIZES) {
    const buf = await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();
    pngBuffers.push(buf);
    console.log(`  ✅ Generated ${size}x${size}`);
  }

  // Generate 512x512 PNG for reference
  await sharp(SOURCE)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(BUILD_DIR, 'icon.png'));
  console.log('  ✅ Generated 512x512 (icon.png)');

  // Generate ICO
  const icoBuffer = createIco(pngBuffers, SIZES);
  fs.writeFileSync(path.join(BUILD_DIR, 'icon.ico'), icoBuffer);
  console.log('  ✅ Generated icon.ico (multi-resolution)');
  
  console.log('\n🎉 Icon generation complete!');
  console.log(`   ICO: ${path.join(BUILD_DIR, 'icon.ico')} (${fs.statSync(path.join(BUILD_DIR, 'icon.ico')).size} bytes)`);
  console.log(`   PNG: ${path.join(BUILD_DIR, 'icon.png')} (${fs.statSync(path.join(BUILD_DIR, 'icon.png')).size} bytes)`);
}

generateIcons().catch(err => {
  console.error('❌ Error generating icons:', err);
  process.exit(1);
});
