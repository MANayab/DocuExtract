#!/usr/bin/env node
/**
 * Verifies that the production build contains the pinned PDF.js standard font
 * files and references them under the GitHub Pages /DocuExtract/ base path.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const fontDir = path.join(dist, 'standard_fonts');

if (!fs.existsSync(fontDir)) {
  throw new Error('Production build is missing dist/standard_fonts/.');
}

const files = fs.readdirSync(fontDir);
const fonts = files.filter((name) => /\.(pfb|ttf)$/i.test(name));
const licenses = files.filter((name) => /^LICENSE_/.test(name));

if (fonts.length !== 14 || licenses.length !== 2) {
  throw new Error(
    `Production build contains ${fonts.length} standard fonts and ${licenses.length} license files; expected 14 fonts and 2 licenses.`,
  );
}

const assetsDir = path.join(dist, 'assets');
const scripts = fs.readdirSync(assetsDir)
  .filter((name) => name.endsWith('.js'))
  .map((name) => fs.readFileSync(path.join(assetsDir, name), 'utf8'));
const appCode = scripts.join('\n');

if (!appCode.includes('/DocuExtract/standard_fonts/')) {
  throw new Error('Production JavaScript does not resolve standard fonts under /DocuExtract/standard_fonts/.');
}


console.log('[pdfjs] production standard fonts and /DocuExtract/ base path verified.');
