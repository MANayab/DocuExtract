// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import packageJson from '../../../package.json';
import lockfile from '../../../package-lock.json';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');
const version = String(packageJson.version);

describe('documentation consistency', () => {
  it('keeps package and lockfile versions synchronized', () => {
    expect(lockfile.version).toBe(version);
    expect(lockfile.packages[''].version).toBe(version);
  });

  it('keeps the README badge and first changelog release synchronized', () => {
    expect(read('README.md')).toContain('version-' + version + '-');
    expect(read('CHANGELOG.md')).toContain('## [' + version + '] —');
  });

  it('lists every released changelog version in the roadmap and keeps Next unreleased', () => {
    const changelog = read('CHANGELOG.md');
    const roadmap = read('docs/ROADMAP.md');
    const released = [
      ...changelog.matchAll(
        /^## \[(\d+\.\d+\.\d+)\] — \d{4}-\d{2}-\d{2}$/gm,
      ),
    ].map((match) => match[1]);

    for (const item of released) {
      expect(roadmap).toContain('v' + item);
    }

    const next = roadmap.split(/^## Next$/m)[1]?.split(/^## /m)[0] ?? '';
    for (const item of released) {
      expect(next).not.toContain('v' + item);
    }
  });

  it('rejects released preparation markers and stale OCR wording', () => {
    const changelog = read('CHANGELOG.md');
    expect(changelog).not.toMatch(
      /^## \[\d+\.\d+\.\d+\] — In preparation$/m,
    );

    for (const file of ['README.md', 'docs/ROADMAP.md']) {
      const value = read(file);
      expect(value).not.toContain('OCR is not implemented');
      expect(value).not.toContain('OCR not implemented in v1.0.0');
    }
  });
});
