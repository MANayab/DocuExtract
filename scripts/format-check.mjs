import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const extensions = [
  '*.ts', '*.tsx', '*.js', '*.jsx', '*.json', '*.yml', '*.yaml', '*.css', '*.html',
];
let base = 'origin/main';
try {
  execFileSync('git', ['rev-parse', '--verify', base], { stdio: 'ignore' });
} catch {
  base = 'HEAD^';
}

let files = [];
try {
  files = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`, '--', ...extensions],
    { encoding: 'utf8' },
  )
    .split(/\r?\n/)
    .filter((file) => file && existsSync(resolve(file)));
} catch {
  console.error('Unable to determine changed files for the formatting check.');
  process.exit(1);
}

if (files.length === 0) {
  console.log('No changed source or configuration files require formatting checks.');
} else {
  const prettier = resolve('node_modules/prettier/bin/prettier.cjs');
  execFileSync(process.execPath, [prettier, '--check', ...files], { stdio: 'inherit' });
}
