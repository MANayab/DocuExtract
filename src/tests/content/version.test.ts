import packageJson from '../../../package.json';
import lockfile from '../../../package-lock.json';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE } from '../../content/site';

describe('release version consistency', () => {
  it('uses package.json as the application version source', () => {
    expect(SITE.version).toBe(packageJson.version);
  });

  it('keeps package-lock root metadata synchronized', () => {
    expect(lockfile.version).toBe(packageJson.version);
    expect(lockfile.packages[''].version).toBe(packageJson.version);
  });

  it('keeps the README badge and changelog aligned with the release', () => {
    const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');
    const changelog = readFileSync(resolve(process.cwd(), 'CHANGELOG.md'), 'utf8');
    const roadmap = readFileSync(resolve(process.cwd(), 'docs/ROADMAP.md'), 'utf8');
    const llms = readFileSync(resolve(process.cwd(), 'public/llms.txt'), 'utf8');
    const sitemap = readFileSync(resolve(process.cwd(), 'public/sitemap.xml'), 'utf8');
    expect(readme).toContain('version-' + packageJson.version + '-C8431F');
    expect(changelog).toContain('## [' + packageJson.version + '] — 2026-11-07');
    expect(roadmap).toContain('## v1.6.1 release candidate');
    expect(llms).toContain('Current application version: ' + packageJson.version);
    expect(sitemap).toContain('<lastmod>2026-11-07</lastmod>');
  });
});
