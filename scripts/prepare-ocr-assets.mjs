#!/usr/bin/env node
/**
 * Copies the Tesseract worker, WASM core and English language data into
 * public/ocr/ so OCR runs fully offline from this site (no CDN requests).
 *
 * Sources (all local):
 *   worker  node_modules/tesseract.js/dist/worker.min.js
 *   core    node_modules/tesseract.js-core/*lstm*.wasm.js
 *   lang    ocr-data/eng.traineddata[.gz]  or  node_modules/@tesseract.js-data/eng/**
 *
 * If anything is missing the build still succeeds; OCR is simply reported as
 * "not installed" in the app. See docs/OCR.md.
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

const mb = (file) => `${(fs.statSync(file).size / 1024 / 1024).toFixed(1)} MB`;

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

const candidates = [
  path.join(root, 'ocr-data', 'eng.traineddata.gz'),
  path.join(root, 'ocr-data', 'eng.traineddata'),
  ...walk(modules('@tesseract.js-data', 'eng')).filter((f) => /eng\.traineddata(\.gz)?$/.test(f)),
];
// Prefer the "best, integer" model when the package ships several.
candidates.sort((a, b) => Number(b.includes('best_int')) - Number(a.includes('best_int')));
const lang = candidates.find((f) => fs.existsSync(f));

if (!lang) {
  disable("English language data not found. Run: npm install --save-exact '@tesseract.js-data/eng'");
  process.exit(0);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'core'), { recursive: true });
fs.mkdirSync(path.join(out, 'lang'), { recursive: true });

fs.copyFileSync(worker, path.join(out, 'worker.min.js'));
for (const file of cores) fs.copyFileSync(path.join(coreDir, file), path.join(out, 'core', file));

const gzip = lang.endsWith('.gz');
fs.copyFileSync(lang, path.join(out, 'lang', gzip ? 'eng.traineddata.gz' : 'eng.traineddata'));

const version = JSON.parse(fs.readFileSync(modules('tesseract.js', 'package.json'), 'utf8')).version;
fs.writeFileSync(
  path.join(out, 'manifest.json'),
  JSON.stringify({ engine: `tesseract.js@${version}`, lang: 'eng', gzip }, null, 2),
);

console.log(`[ocr] bundled worker, ${cores.length} core file(s) and ${path.basename(lang)} (${mb(lang)}) into public/ocr/`);
