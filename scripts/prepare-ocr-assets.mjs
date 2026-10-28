#!/usr/bin/env node
/**
 * Copies the Tesseract worker, WASM core and allowlisted language data into
 * public/ocr/ so OCR runs fully offline from this site (no CDN requests).
 *
 * Sources (all local):
 *   worker  node_modules/tesseract.js/dist/worker.min.js
 *   core    node_modules/tesseract.js-core/*lstm*.wasm.js
 *   lang    ocr-data/eng.traineddata[.gz]  or  node_modules/@tesseract.js-data/eng/**
 *
 * English is required for OCR. German is included when its pinned package/model is available.
 * Missing optional language data is reported in the manifest rather than silently substituted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'ocr');
const modules = (...parts) => path.join(root, 'node_modules', ...parts);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function disable(reason) {
  fs.rmSync(out, { recursive: true, force: true });
  console.warn(`[ocr] OCR not bundled: ${reason}`);
  console.warn('[ocr] The app will build normally; scanned PDFs will show "OCR not installed". See docs/OCR.md.');
}

const worker = modules('tesseract.js', 'dist', 'worker.min.js');
if (!fs.existsSync(worker)) {
  disable('node_modules/tesseract.js/dist/worker.min.js not found (run npm ci).');
  process.exit(0);
}

const coreDir = modules('tesseract.js-core');
const allCores = fs.existsSync(coreDir)
  ? fs.readdirSync(coreDir).filter((f) => /^tesseract-core.*\.wasm\.js$/.test(f))
  : [];
const cores = allCores.some((f) => f.includes('lstm')) ? allCores.filter((f) => f.includes('lstm')) : allCores;

if (cores.length === 0) {
  disable('tesseract.js-core WASM files not found (run npm ci).');
  process.exit(0);
}

const supportedLanguages = ['eng', 'deu'];
const bundled = [];

for (const language of supportedLanguages) {
  const candidates = [
    path.join(root, 'ocr-data', `${language}.traineddata.gz`),
    path.join(root, 'ocr-data', `${language}.traineddata`),
    ...walk(modules('@tesseract.js-data', language)).filter((f) => new RegExp(`${language}\\.traineddata(\\.gz)?$`).test(f)),
  ];
  candidates.sort((a, b) => Number(b.includes('best_int')) - Number(a.includes('best_int')));
  const source = candidates.find((f) => fs.existsSync(f));
  if (!source) {
    if (language === 'eng') {
      disable('English language data not found. Run npm ci or add ocr-data/eng.traineddata.gz.');
      process.exit(0);
    }
    disable(`Required language data missing: ${language}. Run npm ci and verify the pinned language-data package.`);
    process.exit(1);
  }
  bundled.push({ language, source, gzip: source.endsWith('.gz') });
}

if (new Set(bundled.map((item) => item.gzip)).size > 1) {
  disable('Bundled language models must use the same compression format.');
  process.exit(0);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'core'), { recursive: true });
fs.mkdirSync(path.join(out, 'lang'), { recursive: true });
fs.copyFileSync(worker, path.join(out, 'worker.min.js'));
for (const file of cores) fs.copyFileSync(path.join(coreDir, file), path.join(out, 'core', file));

for (const item of bundled) {
  const extension = item.gzip ? '.traineddata.gz' : '.traineddata';
  fs.copyFileSync(item.source, path.join(out, 'lang', `${item.language}${extension}`));
}

const version = JSON.parse(fs.readFileSync(modules('tesseract.js', 'package.json'), 'utf8')).version;
const gzip = bundled[0].gzip;
fs.writeFileSync(
  path.join(out, 'manifest.json'),
  JSON.stringify({ engine: `tesseract.js@${version}`, lang: 'eng', languages: bundled.map((item) => item.language), gzip }, null, 2),
);

console.log(`[ocr] bundled worker, ${cores.length} core file(s), languages: ${bundled.map((item) => item.language).join(', ')} into public/ocr/`);
