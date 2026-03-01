#!/usr/bin/env node
/**
 * Generate app icons from the master SVG.
 * Produces PNG at multiple sizes + ICO for Windows.
 *
 * Usage: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const SVG_PATH = path.join(ASSETS_DIR, 'icon.svg');
const SIZES = [16, 32, 48, 64, 128, 256, 512, 1024];

async function main() {
  // Use sharp programmatically
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.log('Installing sharp...');
    execSync('npm install --no-save sharp', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    sharp = require('sharp');
  }

  const svgBuffer = fs.readFileSync(SVG_PATH);
  console.log('Generating icons from', SVG_PATH);

  // Generate PNGs at each size
  for (const size of SIZES) {
    const outPath = path.join(ASSETS_DIR, `icon-${size}.png`);
    await sharp(svgBuffer, { density: 300 })
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`  icon-${size}.png`);
  }

  // Copy 256px as the main icon.png (electron-builder default)
  fs.copyFileSync(
    path.join(ASSETS_DIR, 'icon-256.png'),
    path.join(ASSETS_DIR, 'icon.png')
  );
  console.log('  icon.png (256px copy)');

  // Generate ICO
  try {
    let pngToIco;
    try {
      pngToIco = require('png-to-ico');
    } catch {
      console.log('Installing png-to-ico...');
      execSync('npm install --no-save png-to-ico', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
      pngToIco = require('png-to-ico');
    }

    const icoPaths = [16, 32, 48, 64, 128, 256].map(s =>
      path.join(ASSETS_DIR, `icon-${s}.png`)
    );
    const icoBuffer = await (pngToIco.default || pngToIco.imagesToIco || pngToIco)(icoPaths);
    fs.writeFileSync(path.join(ASSETS_DIR, 'icon.ico'), icoBuffer);
    console.log('  icon.ico (multi-size)');
  } catch (e) {
    console.log('  [skip] icon.ico —', e.message);
  }

  console.log('\nDone!');
}

main().catch(console.error);
