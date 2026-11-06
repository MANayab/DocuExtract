#!/usr/bin/env node
/**
 * Verifies the generated PDF.js standard fonts, precache manifest and service
 * worker build identity in the production output.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const dist = path.join(root, 'dist');
const fontDir = path.join(dist, 'standard_fonts');
const assetsDir = path.join(dist, 'assets');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const manifestPath = path.join(dist, 'precache-manifest.json');
const workerPath = path.join(dist, 'sw.js');

if (!fs.existsSync(fontDir)) {
  throw new Error('Production build is missing dist/standard_fonts/.');
}

const fontFiles = fs.readdirSync(fontDir).filter((name) => /\.(pfb|ttf)$/i.test(name));
const licenseFiles = fs.readdirSync(fontDir).filter((name) => /^LICENSE_/.test(name));

if (fontFiles.length !== 14 || licenseFiles.length !== 2) {
  throw new Error(
    `Production build contains ${fontFiles.length} standard fonts and ${licenseFiles.length} license files; expected 14 fonts and 2 licenses.`,
  );
}

if (!fs.existsSync(manifestPath) || !fs.existsSync(workerPath)) {
  throw new Error('Production build is missing its PWA precache manifest or service worker.');
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const worker = fs.readFileSync(workerPath, 'utf8');
if (manifest.version !== packageJson.version || !manifest.buildId?.startsWith(`${packageJson.version}-`)) {
  throw new Error('PWA precache manifest version/build ID does not match package.json.');
}
if (worker.includes('__DOCUEXTRACT_BUILD_ID__') || !worker.includes(`const BUILD_ID = '${manifest.buildId}'`)) {
  throw new Error('Built service worker does not contain the generated precache build ID.');
}

const expectedFonts = fontFiles.map((name) => `standard_fonts/${name}`);
const missingFonts = expectedFonts.filter((name) => !manifest.assets.includes(name));
if (missingFonts.length) {
  throw new Error(`PWA precache manifest is missing PDF.js fonts: ${missingFonts.join(', ')}`);
}

const hashedAssets = fs
  .readdirSync(assetsDir)
  .filter((name) => /-[A-Za-z0-9_-]{8,}\./.test(name))
  .map((name) => `assets/${name}`);
const missingAssets = hashedAssets.filter((name) => !manifest.assets.includes(name));
if (missingAssets.length) {
  throw new Error(`PWA precache manifest is missing hashed build assets: ${missingAssets.join(', ')}`);
}

const scripts = fs
  .readdirSync(assetsDir)
  .filter((name) => name.endsWith('.js'))
  .map((name) => fs.readFileSync(path.join(assetsDir, name), 'utf8'));
const appCode = scripts.join('\\n');

if (!appCode.includes('/DocuExtract/standard_fonts/')) {
  throw new Error('Production JavaScript does not resolve standard fonts under /DocuExtract/standard_fonts/.');
}

console.log(
  `[pwa] ${manifest.buildId}: ${manifest.assets.length} precached assets, ${fontFiles.length} PDF.js fonts, generated service-worker ID verified.`,
);
