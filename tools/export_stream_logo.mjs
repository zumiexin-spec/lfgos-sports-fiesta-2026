import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const exportDir = path.join(rootDir, 'exports');
const tempFramesDir = path.join(exportDir, 'temp_frames');

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}
if (!fs.existsSync(tempFramesDir)) {
  fs.mkdirSync(tempFramesDir, { recursive: true });
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (err) {
    return await chromium.launch({ channel: 'msedge', headless: true });
  }
}

async function exportVideos() {
  console.log('Generating 1080p 3-second animated logo stream exports...');
  const browser = await launchBrowser();

  const logoBase64 = fs.readFileSync(path.join(rootDir, 'assets', 'logo.png')).toString('base64');
  const logoDataUri = `data:image/png;base64,${logoBase64}`;

  // 1. Render MP4 frames (with Dark Night Indigo background)
  console.log('Rendering frames for MP4 (1920x1080 with stadium night background)...');
  const contextMp4 = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  const pageMp4 = await contextMp4.newPage();

  const totalFrames = 90; // 3 seconds at 30 fps
  const circumference = 2 * Math.PI * 260; // radius 260 => ~1633.6

  for (let f = 0; f < totalFrames; f++) {
    const progress = f / (totalFrames - 1); // 0.0 to 1.0
    // Ring draw: complete by frame 60 (2s)
    const ringProgress = Math.min(1.0, progress * 1.5);
    const dashoffset = circumference * (1 - ringProgress);

    // Scale logo: 0.92 to 1.0 (ease out)
    const scale = 0.92 + 0.08 * (1 - Math.pow(1 - progress, 3));

    // Sweep: translateX -160% to 160% between 0.2 and 0.8 progress
    let sweepPos = -160;
    if (progress > 0.15 && progress < 0.85) {
      sweepPos = -160 + ((progress - 0.15) / 0.70) * 320;
    } else if (progress >= 0.85) {
      sweepPos = 160;
    }

    // Tagline opacity
    const tagOpacity = Math.min(1, Math.max(0, (progress - 0.3) / 0.4));

    await pageMp4.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body {
            width: 1920px;
            height: 1080px;
            background: radial-gradient(circle at center, #1746A2 0%, #080F2B 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          .stage {
            position: relative;
            width: 580px;
            height: 580px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .ring-svg {
            position: absolute;
            inset: 0;
            width: 580px;
            height: 580px;
            transform: rotate(-90deg);
          }
          .ring-bg {
            fill: none;
            stroke: rgba(255, 255, 255, 0.1);
            stroke-width: 6;
          }
          .ring-circ {
            fill: none;
            stroke: #00E5FF;
            stroke-width: 7;
            stroke-linecap: round;
            stroke-dasharray: ${circumference};
            stroke-dashoffset: ${dashoffset};
          }
          .logo-wrapper {
            position: relative;
            width: 480px;
            height: 480px;
            border-radius: 50%;
            overflow: hidden;
            transform: scale(${scale});
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .logo-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .sheen {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: linear-gradient(135deg, transparent 35%, rgba(255,255,255,0.6) 50%, transparent 65%);
            transform: translateX(${sweepPos}%) skewX(-20deg);
            pointer-events: none;
          }
          .tagline {
            margin-top: 36px;
            font-weight: 800;
            font-style: italic;
            font-size: 38px;
            letter-spacing: 0.12em;
            color: #FFFFFF;
            opacity: ${tagOpacity};
            text-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
          }
          .sub {
            margin-top: 8px;
            font-weight: 700;
            font-size: 20px;
            letter-spacing: 0.08em;
            color: #00E5FF;
            opacity: ${tagOpacity};
          }
        </style>
      </head>
      <body>
        <div class="stage">
          <svg class="ring-svg" viewBox="0 0 580 580">
            <circle class="ring-bg" cx="290" cy="290" r="260" />
            <circle class="ring-circ" cx="290" cy="290" r="260" />
          </svg>
          <div class="logo-wrapper">
            <img class="logo-img" src="${logoDataUri}" alt="LFGOS Sports Fiesta 2026">
            <div class="sheen"></div>
          </div>
        </div>
        <div class="tagline">PLAY • COMPETE • ACHIEVE</div>
        <div class="sub">LITTLE FLOWER GROUP OF SCHOOLS</div>
      </body>
      </html>
    `);

    const frameFile = path.join(tempFramesDir, `mp4_frame_${String(f).padStart(3, '0')}.png`);
    await pageMp4.screenshot({ path: frameFile, type: 'png' });
  }
  await contextMp4.close();

  // 2. Render WebM frames (with Transparent background)
  console.log('Rendering frames for transparent WebM (1920x1080 alpha)...');
  const contextWebm = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  const pageWebm = await contextWebm.newPage();

  for (let f = 0; f < totalFrames; f++) {
    const progress = f / (totalFrames - 1);
    const ringProgress = Math.min(1.0, progress * 1.5);
    const dashoffset = circumference * (1 - ringProgress);
    const scale = 0.92 + 0.08 * (1 - Math.pow(1 - progress, 3));

    let sweepPos = -160;
    if (progress > 0.15 && progress < 0.85) {
      sweepPos = -160 + ((progress - 0.15) / 0.70) * 320;
    } else if (progress >= 0.85) {
      sweepPos = 160;
    }

    const tagOpacity = Math.min(1, Math.max(0, (progress - 0.3) / 0.4));

    await pageWebm.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body {
            width: 1920px;
            height: 1080px;
            background: transparent !important;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          .stage {
            position: relative;
            width: 580px;
            height: 580px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .ring-svg {
            position: absolute;
            inset: 0;
            width: 580px;
            height: 580px;
            transform: rotate(-90deg);
          }
          .ring-bg {
            fill: none;
            stroke: rgba(255, 255, 255, 0.15);
            stroke-width: 6;
          }
          .ring-circ {
            fill: none;
            stroke: #00E5FF;
            stroke-width: 7;
            stroke-linecap: round;
            stroke-dasharray: ${circumference};
            stroke-dashoffset: ${dashoffset};
          }
          .logo-wrapper {
            position: relative;
            width: 480px;
            height: 480px;
            border-radius: 50%;
            overflow: hidden;
            transform: scale(${scale});
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .logo-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .sheen {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: linear-gradient(135deg, transparent 35%, rgba(255,255,255,0.65) 50%, transparent 65%);
            transform: translateX(${sweepPos}%) skewX(-20deg);
            pointer-events: none;
          }
          .tagline {
            margin-top: 36px;
            font-weight: 800;
            font-style: italic;
            font-size: 38px;
            letter-spacing: 0.12em;
            color: #FFFFFF;
            opacity: ${tagOpacity};
            text-shadow: 0 4px 16px rgba(0, 0, 0, 0.8);
          }
          .sub {
            margin-top: 8px;
            font-weight: 700;
            font-size: 20px;
            letter-spacing: 0.08em;
            color: #00E5FF;
            opacity: ${tagOpacity};
          }
        </style>
      </head>
      <body>
        <div class="stage">
          <svg class="ring-svg" viewBox="0 0 580 580">
            <circle class="ring-bg" cx="290" cy="290" r="260" />
            <circle class="ring-circ" cx="290" cy="290" r="260" />
          </svg>
          <div class="logo-wrapper">
            <img class="logo-img" src="${logoDataUri}" alt="LFGOS Sports Fiesta 2026">
            <div class="sheen"></div>
          </div>
        </div>
        <div class="tagline">PLAY • COMPETE • ACHIEVE</div>
        <div class="sub">LITTLE FLOWER GROUP OF SCHOOLS</div>
      </body>
      </html>
    `);

    const frameFile = path.join(tempFramesDir, `webm_frame_${String(f).padStart(3, '0')}.png`);
    await pageWebm.screenshot({ path: frameFile, type: 'png', omitBackground: true });
  }
  await contextWebm.close();
  await browser.close();

  // 3. Assemble MP4 via ffmpeg
  const mp4Out = path.join(exportDir, 'lfgos-sports-fiesta-2026-1080p.mp4');
  console.log(`Encoding MP4 -> ${mp4Out}`);
  const mp4Cmd = `ffmpeg -y -framerate 30 -i "${path.join(tempFramesDir, 'mp4_frame_%03d.png')}" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${mp4Out}"`;
  execSync(mp4Cmd, { stdio: 'inherit' });

  // 4. Assemble transparent WebM via ffmpeg
  const webmOut = path.join(exportDir, 'lfgos-sports-fiesta-2026-transparent.webm');
  console.log(`Encoding transparent WebM -> ${webmOut}`);
  const webmCmd = `ffmpeg -y -framerate 30 -i "${path.join(tempFramesDir, 'webm_frame_%03d.png')}" -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 "${webmOut}"`;
  execSync(webmCmd, { stdio: 'inherit' });

  // 5. Cleanup temporary frames
  console.log('Cleaning up temporary frame PNGs...');
  fs.rmSync(tempFramesDir, { recursive: true, force: true });

  console.log('\n[SUCCESS] Live Stream Video Exports Created:');
  console.log(`- 1080p MP4: ${mp4Out} (${(fs.statSync(mp4Out).size / 1024).toFixed(1)} KB)`);
  console.log(`- Transparent WebM: ${webmOut} (${(fs.statSync(webmOut).size / 1024).toFixed(1)} KB)`);
}

exportVideos().catch(err => {
  console.error('Error generating stream exports:', err);
  process.exit(1);
});
