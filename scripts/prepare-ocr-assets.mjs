#!/usr/bin/env node
/**
 * Copies the Tesseract worker, WASM core and allowlisted language data into
 * public/ocr/ so OCR runs fully offline from this site (no CDN requests).
 *
 * Sources (all local):
 *   worker  node_modules/tesseract.js/dist/worker.min.js
 *   core    node_modules/tesseract.js-core/*lstm*.wasm.js
 *   lang    ocr-data/<lang>.traineddata[.gz] or node_modules/@tesseract.js-data/<lang>/**
 *
 * English, German and Hindi models are required, pinned dependencies. A missing model fails the build.
 * The script reports per-model and total compressed asset sizes for release review.
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
  process.exit(1);
}

const coreDir = modules('tesseract.js-core');
const allCores = fs.existsSync(coreDir)
  ? fs.readdirSync(coreDir).filter((f) => /^tesseract-core.*\.wasm\.js$/.test(f))
  : [];
const cores = allCores.some((f) => f.includes('lstm')) ? allCores.filter((f) => f.includes('lstm')) : allCores;

if (cores.length === 0) {
  disable('tesseract.js-core WASM files not found (run npm ci).');
  process.exit(1);
}

const languageConfig = JSON.parse(fs.readFileSync(path.join(root, 'ocr-languages.json'), 'utf8'));
const supportedLanguages = languageConfig.languages.map((item) => item.code);
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
    disable(`Required language data missing: ${language}. Run npm ci and verify the pinned language-data package.`);
    process.exit(1);
  }
  bundled.push({ language, source, gzip: source.endsWith('.gz'), bytes: fs.statSync(source).size });
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
  const language = languageConfig.languages.find((entry) => entry.code === item.language);
  if (!language) {
    disable(`Language configuration missing for ${item.language}.`);
    process.exit(1);
  }
  fs.copyFileSync(item.source, path.join(out, 'lang', language.fileName));
}

const licenseOut = path.join(out, 'licenses');
fs.mkdirSync(licenseOut, { recursive: true });
const tessdataLicense = path.join(root, 'licenses', 'Apache-2.0-tessdata.txt');
const packageLicense = path.join(root, 'licenses', 'MIT-tesseract-data-packages.txt');
const ocrNotice = path.join(root, 'licenses', 'OCR-NOTICE.txt');
if (!fs.existsSync(tessdataLicense) || !fs.existsSync(packageLicense) || !fs.existsSync(ocrNotice)) {
  disable('OCR redistribution license or notice is missing.');
  process.exit(1);
}
fs.copyFileSync(tessdataLicense, path.join(licenseOut, 'Apache-2.0-tessdata.txt'));
fs.copyFileSync(packageLicense, path.join(licenseOut, 'MIT-tesseract-data-packages.txt'));
fs.copyFileSync(ocrNotice, path.join(licenseOut, 'OCR-NOTICE.txt'));

const version = JSON.parse(fs.readFileSync(modules('tesseract.js', 'package.json'), 'utf8')).version;
const gzip = bundled[0].gzip;
fs.writeFileSync(
  path.join(out, 'manifest.json'),
  JSON.stringify({ engine: `tesseract.js@${version}`, lang: languageConfig.defaultLanguage, languages: bundled.map((item) => item.language), gzip }, null, 2),
);

for (const item of bundled) {
  console.log(`[ocr] model ${item.language}: ${(item.bytes / 1024 / 1024).toFixed(2)} MiB`);
}
const totalModelBytes = bundled.reduce((total, item) => total + item.bytes, 0);
console.log(`[ocr] bundled worker, ${cores.length} core file(s), languages: ${bundled.map((item) => item.language).join(', ')}; models total ${(totalModelBytes / 1024 / 1024).toFixed(2)} MiB in public/ocr/`);
