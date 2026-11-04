#!/usr/bin/env node
/**
 * Copies only PDF.js's standard font data and its redistribution notices into
 * public/standard_fonts/. PDF.js loads these files same-origin when a PDF uses
 * a standard font without an embedded font program.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'node_modules', 'pdfjs-dist', 'standard_fonts');
const output = path.join(root, 'public', 'standard_fonts');

if (!fs.existsSync(source)) {
  throw new Error('PDF.js standard_fonts directory is missing. Run npm ci before preparing assets.');
}

const files = fs.readdirSync(source).filter((name) => /\.(pfb|ttf)$/i.test(name) || /^LICENSE_/.test(name));
const fonts = files.filter((name) => /\.(pfb|ttf)$/i.test(name));
const licenses = files.filter((name) => /^LICENSE_/.test(name));

if (fonts.length !== 14 || licenses.length !== 2) {
  throw new Error(
    `Unexpected PDF.js standard font package contents: found ${fonts.length} fonts and ${licenses.length} license files; expected 14 fonts and 2 licenses for pdfjs-dist@4.10.38.`,
  );
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

let totalBytes = 0;
for (const name of files) {
  const sourcePath = path.join(source, name);
  totalBytes += fs.statSync(sourcePath).size;
  fs.copyFileSync(sourcePath, path.join(output, name));
}

console.log(
  `[pdfjs] bundled ${fonts.length} standard fonts and ${licenses.length} license files (${(totalBytes / 1024).toFixed(1)} KiB) into public/standard_fonts/.`,
);
