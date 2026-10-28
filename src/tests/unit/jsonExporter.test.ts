import { describe, expect, it } from 'vitest';
import { SITE } from '../../content/site';
import { APP_VERSION, buildJson } from '../../features/export/jsonExporter';

describe('JSON export metadata', () => {
  it('uses the current application version in exported JSON', () => {
    expect(APP_VERSION).toBe(SITE.version);
    expect(buildJson([], '2026-10-29T00:00:00.000Z').version).toBe(SITE.version);
  });
});
