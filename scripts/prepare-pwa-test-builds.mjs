#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const builds = path.join(root, '.pwa-test-builds');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

fs.rmSync(builds, { recursive: true, force: true });
fs.mkdirSync(builds, { recursive: true });

for (const label of ['old', 'new', 'failed', 'retry', 'quota']) {
  const env = { ...process.env, DOCUEXTRACT_BUILD_LABEL: label };
  execFileSync(npm, ['run', 'build'], { cwd: root, env, stdio: 'inherit' });
  fs.cpSync(dist, path.join(builds, label), { recursive: true });
}

const failedManifestPath = path.join(builds, 'failed', 'precache-manifest.json');
const failedManifest = JSON.parse(fs.readFileSync(failedManifestPath, 'utf8'));
failedManifest.assets.push('assets/__missing_pwa_update_fixture__.js');
fs.writeFileSync(failedManifestPath, JSON.stringify(failedManifest));

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(builds, 'old'), dist, { recursive: true });
console.log('[pwa-test] Prepared old, new and intentionally broken production builds.');
