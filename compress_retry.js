const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const QUALITY = 80;
const MAX_WIDTH = 1600;
const SKIP_DIRS = ['node_modules', '.git'];
const MIN_SIZE_MB = 1; // Only process files larger than 1MB

let processCount = 0;
let errorCount = 0;

async function processImage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) return;

    try {
        const stats = fs.statSync(filePath);
        const sizeMB = stats.size / (1024 * 1024);

        if (sizeMB < MIN_SIZE_MB) {
            // accessible check
            return;
        }

        console.log(`Processing: ${path.basename(filePath)} (${sizeMB.toFixed(2)} MB)`);

        const image = sharp(filePath);
        const metadata = await image.metadata();

        let pipeline = image;
        if (metadata.width && metadata.width > MAX_WIDTH) {
            pipeline = pipeline.resize(MAX_WIDTH, null, {
                withoutEnlargement: true,
                fit: 'inside'
            });
        }

        let outputBuffer;
        if (ext === '.png') {
            // Convert to JPEG if possible for massive savings, or optimize PNG
            // Use improved PNG compression
            outputBuffer = await pipeline.png({ quality: QUALITY, compressionLevel: 9, palette: true }).toBuffer();
        } else {
            outputBuffer = await pipeline.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
        }

        if (outputBuffer.length < stats.size) {
            fs.writeFileSync(filePath, outputBuffer);
            console.log(`✅ Compressed: ${path.basename(filePath)} -> ${(outputBuffer.length / 1024 / 1024).toFixed(2)} MB`);
        } else {
            console.log(`Skipped (not smaller): ${path.basename(filePath)}`);
        }
        processCount++;

    } catch (err) {
        console.error(`❌ Error ${filePath}: ${err.message}`);
        errorCount++;
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
    console.log('🚀 Starting targeted compression (Files > 1MB)...');
    await walkDir(process.cwd());
    console.log(`\nDone! Processed: ${processCount}, Errors: ${errorCount}`);
}

main();
