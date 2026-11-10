import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const outLogosDir = path.resolve('assets/logos');
const outCrestsDir = path.resolve('assets/crests');
const toolsDir = path.resolve('tools');

if (!fs.existsSync(outLogosDir)) fs.mkdirSync(outLogosDir, { recursive: true });

function removeConnectedBorderBackground(rawBuffer, width, height, channels, tolerance = 18) {
  // Ensure 4 channels RGBA
  const pixels = new Uint8Array(rawBuffer);
  const visited = new Uint8Array(width * height);
  const queue = [];

  // Corner sample for background color
  const bgR = pixels[0];
  const bgG = pixels[1];
  const bgB = pixels[2];

  function isBg(idx) {
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    const dr = r - bgR;
    const dg = g - bgG;
    const db = b - bgB;
    return Math.sqrt(dr * dr + dg * dg + db * db) <= tolerance;
  }

  // Push all 4 borders
  for (let x = 0; x < width; x++) {
    // top
    const topIdx = (0 * width + x) * 4;
    if (isBg(topIdx)) {
      queue.push(0 * width + x);
      visited[0 * width + x] = 1;
    }
    // bottom
    const botIdx = ((height - 1) * width + x) * 4;
    if (isBg(botIdx)) {
      queue.push((height - 1) * width + x);
      visited[(height - 1) * width + x] = 1;
    }
  }

  for (let y = 0; y < height; y++) {
    // left
    const leftIdx = (y * width + 0) * 4;
    if (!visited[y * width + 0] && isBg(leftIdx)) {
      queue.push(y * width + 0);
      visited[y * width + 0] = 1;
    }
    // right
    const rightIdx = (y * width + (width - 1)) * 4;
    if (!visited[y * width + (width - 1)] && isBg(rightIdx)) {
      queue.push(y * width + (width - 1));
      visited[y * width + (width - 1)] = 1;
    }
  }

  // BFS Flood Fill
  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % width;
    const cy = Math.floor(curr / width);

    // Set alpha to 0
    pixels[curr * 4 + 3] = 0;

    // 4 neighbours
    const neighbours = [
      cy > 0 ? (cy - 1) * width + cx : -1,
      cy < height - 1 ? (cy + 1) * width + cx : -1,
      cx > 0 ? cy * width + (cx - 1) : -1,
      cx < width - 1 ? cy * width + (cx + 1) : -1
    ];

    for (const n of neighbours) {
      if (n !== -1 && !visited[n]) {
        visited[n] = 1;
        if (isBg(n * 4)) {
          queue.push(n);
        }
      }
    }
  }

  // Soft de-fringing on outer border
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const pIdx = idx * 4;
      if (pixels[pIdx + 3] > 0) {
        // If adjacent to transparent pixel, soften edge
        let adjTransparent = false;
        if (pixels[((y - 1) * width + x) * 4 + 3] === 0 ||
            pixels[((y + 1) * width + x) * 4 + 3] === 0 ||
            pixels[(y * width + (x - 1)) * 4 + 3] === 0 ||
            pixels[(y * width + (x + 1)) * 4 + 3] === 0) {
          adjTransparent = true;
        }
        if (adjTransparent) {
          const r = pixels[pIdx];
          const g = pixels[pIdx + 1];
          const b = pixels[pIdx + 2];
          // If close to white, taper alpha to prevent white halo
          if (r > 230 && g > 230 && b > 230) {
            const whiteness = (r + g + b) / (3 * 255);
            pixels[pIdx + 3] = Math.round(255 * (1 - (whiteness - 0.9) / 0.1 * 0.7));
          }
        }
      }
    }
  }

  return Buffer.from(pixels);
}

async function processImage(inputPath, baseName, isCircular = false) {
  console.log(`Processing ${baseName}...`);
  const image = sharp(inputPath);
  const metadata = await image.metadata();

  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cleanedData = removeConnectedBorderBackground(data, info.width, info.height, info.channels);

  let processed = sharp(cleanedData, { raw: { width: info.width, height: info.height, channels: 4 } });
  const initialPng = await processed.png().toBuffer();

  // Trim transparent pixels
  const trimmed = await sharp(initialPng).trim().png().toBuffer({ resolveWithObject: true });
  const trimMeta = trimmed.info;

  // Calculate 4% uniform transparent padding
  const padX = Math.max(4, Math.round(trimMeta.width * 0.04));
  const padY = Math.max(4, Math.round(trimMeta.height * 0.04));

  const padded = sharp(trimmed.data).extend({
    top: padY,
    bottom: padY,
    left: padX,
    right: padX,
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  });

  const finalBuffer = await padded.png().toBuffer();
  const finalMeta = await sharp(finalBuffer).metadata();

  // Export 1x, 2x, 3x PNG & WebP
  // Target base widths:
  // Crests: 1x = 160px, 2x = 320px, 3x = 480px
  // Fiesta logo: 1x = 200px, 2x = 400px, 3x = 600px
  const baseW = isCircular ? 200 : 160;
  const sizes = [
    { scale: '1x', width: baseW },
    { scale: '2x', width: baseW * 2 },
    { scale: '3x', width: baseW * 3 }
  ];

  const manifestEntry = {
    name: baseName,
    is_circular: isCircular,
    aspect_ratio: (finalMeta.width / finalMeta.height).toFixed(3),
    original_size: { width: finalMeta.width, height: finalMeta.height },
    exports: {}
  };

  for (const s of sizes) {
    const resized = sharp(finalBuffer).resize({ width: s.width, fit: 'contain' });
    const pngPath = path.join(outLogosDir, `${baseName}_${s.scale}.png`);
    const webpPath = path.join(outLogosDir, `${baseName}_${s.scale}.webp`);

    const pngBuf = await resized.png({ compressionLevel: 9 }).toBuffer();
    const webpBuf = await sharp(finalBuffer).resize({ width: s.width, fit: 'contain' }).webp({ quality: 90 }).toBuffer();

    fs.writeFileSync(pngPath, pngBuf);
    fs.writeFileSync(webpPath, webpBuf);

    manifestEntry.exports[s.scale] = {
      width: s.width,
      png_bytes: pngBuf.length,
      png_path: `./assets/logos/${baseName}_${s.scale}.png`,
      webp_bytes: webpBuf.length,
      webp_path: `./assets/logos/${baseName}_${s.scale}.webp`
    };
  }

  // Also write canonical webp/png to standard folder for simple backwards-compatible reference
  const canonicalPng = isCircular ? path.resolve('assets/logo.png') : path.resolve(outCrestsDir, `${baseName}.png`);
  const canonicalWebp = isCircular ? path.resolve('assets/logo.webp') : path.resolve(outCrestsDir, `${baseName}.webp`);

  const optPng = await sharp(finalBuffer).resize({ width: baseW * 2 }).png({ compressionLevel: 9 }).toBuffer();
  const optWebp = await sharp(finalBuffer).resize({ width: baseW * 2 }).webp({ quality: 90 }).toBuffer();
  fs.writeFileSync(canonicalPng, optPng);
  fs.writeFileSync(canonicalWebp, optWebp);

  return { manifestEntry, finalBuffer };
}

async function run() {
  console.log('=== STARTING OFFLINE LOGO & CREST BACKGROUND REMOVAL ===\n');

  const manifest = {
    generated_at: new Date().toISOString(),
    tool: 'tools/process_logos.mjs (Sharp 0.35.5 / libvips)',
    items: {}
  };

  // 1. Process Fiesta Logo
  const fiestaOriginal = path.resolve('assets/original/fiesta.png');
  const { manifestEntry: fiestaEntry, finalBuffer: fiestaBuffer } = await processImage(fiestaOriginal, 'fiesta_logo', true);
  manifest.items['fiesta_logo'] = fiestaEntry;

  // Also write root fiesta.png
  const rootFiestaPng = await sharp(fiestaBuffer).resize({ width: 400 }).png().toBuffer();
  fs.writeFileSync(path.resolve('fiesta.png'), rootFiestaPng);

  // 2. Process School Crests
  const crestNames = [
    'sikatiya',
    'ghoshi',
    'international',
    'nizamuddinpura',
    'kiriharpur',
    'kasimabad'
  ];

  for (const name of crestNames) {
    const originalPath = path.resolve(`assets/original/crests/${name}.png`);
    const { manifestEntry } = await processImage(originalPath, name, false);
    manifest.items[name] = manifestEntry;
  }

  // 3. Generate Dark Mode Previews for Fiesta Logo:
  // Option (a): Flat single-color white #FFFFFF version made from alpha mask
  console.log('\nGenerating Dark Mode Option (a): Flat White silhouette...');
  const { data: fData, info: fInfo } = await sharp(fiestaBuffer).resize(400, 400).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const flatWhitePixels = new Uint8Array(fData);
  for (let i = 0; i < flatWhitePixels.length; i += 4) {
    if (flatWhitePixels[i + 3] > 20) {
      flatWhitePixels[i] = 255;     // R
      flatWhitePixels[i + 1] = 255; // G
      flatWhitePixels[i + 2] = 255; // B
      // keep alpha
    } else {
      flatWhitePixels[i + 3] = 0;
    }
  }
  const optionABuffer = await sharp(flatWhitePixels, { raw: { width: 400, height: 400, channels: 4 } }).png().toBuffer();
  fs.writeFileSync(path.join(outLogosDir, 'fiesta_logo_dark_flat_white.png'), optionABuffer);
  fs.writeFileSync(path.join(outLogosDir, 'fiesta_logo_dark_flat_white.webp'), await sharp(optionABuffer).webp().toBuffer());

  // Option (b): Full-colour transparent logo on soft circular Ice-blue badge (#EAF2FF with subtle drop shadow)
  console.log('Generating Dark Mode Option (b): Full-colour on soft circular Ice-blue badge...');
  const badgeSvg = Buffer.from(`
    <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="iceBadge" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stop-color="#EAF2FF" stop-opacity="0.95" />
          <stop offset="92%" stop-color="#CFE2FF" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#B8F1FF" stop-opacity="0.4" />
        </radialGradient>
        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
          <feOffset dx="0" dy="2" result="offsetblur" />
          <feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="200" cy="200" r="190" fill="url(#iceBadge)" filter="url(#softGlow)" />
    </svg>
  `);
  const logoResized = await sharp(fiestaBuffer).resize(360, 360).png().toBuffer();
  const optionBBuffer = await sharp(badgeSvg)
    .composite([{ input: logoResized, top: 20, left: 20 }])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(outLogosDir, 'fiesta_logo_dark_ice_badge.png'), optionBBuffer);
  fs.writeFileSync(path.join(outLogosDir, 'fiesta_logo_dark_ice_badge.webp'), await sharp(optionBBuffer).webp().toBuffer());

  // Set default dark mode logo to Option (b)
  fs.writeFileSync(path.resolve('assets/logo-dark.png'), optionBBuffer);
  fs.writeFileSync(path.resolve('assets/logo-dark.webp'), await sharp(optionBBuffer).webp().toBuffer());

  // 4. Regenerate Icons and OG-Image
  console.log('\nRegenerating icon-192, icon-512, icon-maskable and og-image...');
  // icon-192
  await sharp(fiestaBuffer).resize(192, 192).png().toFile('assets/icon-192.png');
  // icon-512
  await sharp(fiestaBuffer).resize(512, 512).png().toFile('assets/icon-512.png');
  // logo-36
  await sharp(fiestaBuffer).resize(36, 36).png().toFile('assets/logo-36.png');

  // icon-maskable: Rounded Ice #EAF2FF square with safe padding (80% safe zone)
  const maskableSvg = Buffer.from(`
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="104" fill="#EAF2FF" />
    </svg>
  `);
  const fiestaForMaskable = await sharp(fiestaBuffer).resize(390, 390).png().toBuffer();
  await sharp(maskableSvg)
    .composite([{ input: fiestaForMaskable, top: 61, left: 61 }])
    .png()
    .toFile('assets/icon-maskable.png');

  // og-image: 1200x630 branded card
  const ogSvg = Buffer.from(`
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ogBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#080F2B" />
          <stop offset="50%" stop-color="#0E1E4D" />
          <stop offset="100%" stop-color="#2448FF" />
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#ogBg)" />
      <text x="560" y="240" font-family="'Barlow Condensed', sans-serif" font-weight="800" font-style="italic" font-size="64" fill="#FFFFFF" letter-spacing="2">LFGOS SPORTS FIESTA 2026</text>
      <text x="560" y="310" font-family="'Barlow', sans-serif" font-weight="700" font-size="28" fill="#B8F1FF">13 &amp; 14 November 2026</text>
      <text x="560" y="360" font-family="'Barlow', sans-serif" font-weight="600" font-size="22" fill="#EAF2FF">Dr. Bhimrao Ambedkar Sports Stadium, Mau</text>
      <text x="560" y="440" font-family="'Barlow Condensed', sans-serif" font-weight="800" font-style="italic" font-size="32" fill="#FFC342">OFFICIAL PUBLIC LIVE PORTAL</text>
    </svg>
  `);
  const fiestaForOg = await sharp(fiestaBuffer).resize(420, 420).png().toBuffer();
  await sharp(ogSvg)
    .composite([{ input: fiestaForOg, top: 105, left: 90 }])
    .png()
    .toFile('assets/og-image.png');

  // 5. Write manifest.json
  const manifestPath = path.join(outLogosDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written to: ${manifestPath}`);
  console.log('=== LOGO PROCESSING COMPLETE ===');
}

run().catch(err => {
  console.error('Logo processing failed:', err);
  process.exit(1);
});
