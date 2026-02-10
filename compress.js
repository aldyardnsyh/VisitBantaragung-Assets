const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const QUALITY = 80;
const MAX_WIDTH = 1600;
const SKIP_DIRS = ['node_modules', '.git'];

let totalOriginal = 0;
let totalCompressed = 0;
let fileCount = 0;

async function processImage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) return;

    const stats = fs.statSync(filePath);
    const originalSize = stats.size;
    totalOriginal += originalSize;

    try {
        const image = sharp(filePath);
        const metadata = await image.metadata();

        let pipeline = image;

        // Resize if wider than MAX_WIDTH
        if (metadata.width && metadata.width > MAX_WIDTH) {
            pipeline = pipeline.resize(MAX_WIDTH, null, {
                withoutEnlargement: true,
                fit: 'inside'
            });
        }

        // Compress based on format
        let outputBuffer;
        if (ext === '.png') {
            outputBuffer = await pipeline.png({ quality: QUALITY, compressionLevel: 9 }).toBuffer();
        } else {
            outputBuffer = await pipeline.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
        }

        const compressedSize = outputBuffer.length;
        totalCompressed += compressedSize;

        // Only write if actually smaller
        if (compressedSize < originalSize) {
            fs.writeFileSync(filePath, outputBuffer);
            const saved = ((1 - compressedSize / originalSize) * 100).toFixed(1);
            console.log(`✅ ${path.relative(process.cwd(), filePath)}: ${(originalSize / 1024 / 1024).toFixed(2)} MB → ${(compressedSize / 1024 / 1024).toFixed(2)} MB (-${saved}%)`);
        } else {
            totalCompressed = totalCompressed - compressedSize + originalSize;
            console.log(`⏭️  ${path.relative(process.cwd(), filePath)}: already optimal`);
        }
        fileCount++;
    } catch (err) {
        console.error(`❌ ${filePath}: ${err.message}`);
    }
}

async function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (SKIP_DIRS.includes(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            await walkDir(fullPath);
        } else {
            await processImage(fullPath);
        }
    }
}

async function main() {
    console.log('🖼️  Compressing images...');
    console.log(`   Max width: ${MAX_WIDTH}px, Quality: ${QUALITY}%\n`);

    await walkDir(process.cwd());

    console.log(`\n📊 Summary:`);
    console.log(`   Files processed: ${fileCount}`);
    console.log(`   Total original:   ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Total compressed: ${(totalCompressed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Saved: ${((1 - totalCompressed / totalOriginal) * 100).toFixed(1)}%`);
}

main();
