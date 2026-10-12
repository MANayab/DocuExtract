// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { jsonLd, seoHead, staticContent } from '../../content/seo';
import { SITE, faqItems, features } from '../../content/site';

// Vitest runs from the repository root on every platform (no file-URL path quirks on Windows).
const publicFile = (name: string) => readFileSync(resolve(process.cwd(), 'public', name), 'utf8');

const embeddedJson = (head: string) => {
  const match = head.match(/<script type="application\/ld\+json">(.*)<\/script>/s);
  return JSON.parse(match ? match[1] : 'null');
};

describe('search snippet basics', () => {
  it('keeps the title and description inside Google display limits', () => {
    expect(SITE.title.length).toBeLessThanOrEqual(60);
    expect(SITE.description.length).toBeGreaterThanOrEqual(70);
    expect(SITE.description.length).toBeLessThanOrEqual(160);
  });

  it('points canonical, Open Graph and sitemap at the deployed GitHub Pages URL', () => {
    const head = seoHead(false);

    expect(SITE.url).toBe('https://manayab.github.io/DocuExtract/');
    expect(head).toContain(`<link rel="canonical" href="${SITE.url}" />`);
    expect(head).toContain(`<meta property="og:url" content="${SITE.url}" />`);
    expect(head).toContain(`<meta property="og:image" content="${SITE.url}og-image.png" />`);
    expect(publicFile('sitemap.xml')).toContain(`<loc>${SITE.url}</loc>`);
    expect(publicFile('robots.txt')).toContain(`Sitemap: ${SITE.url}sitemap.xml`);
  });

  it('only injects a Search Console token when one is configured', () => {
    expect(seoHead(false).includes('google-site-verification')).toBe(SITE.googleSiteVerification !== '');
  });
});

describe('structured data', () => {
  it.each([false, true])('is valid JSON and mirrors the visible FAQ exactly (ocr bundled: %s)', (ocr) => {
    const graph = embeddedJson(seoHead(ocr))['@graph'];
    const faq = graph.find((node: { '@type': string }) => node['@type'] === 'FAQPage');

    expect(graph.map((node: { '@type': string }) => node['@type'])).toEqual(['WebSite', 'WebApplication', 'FAQPage']);
    expect(faq.mainEntity).toHaveLength(faqItems(ocr).length);
    faqItems(ocr).forEach((item, i) => {
      expect(faq.mainEntity[i].name).toBe(item.q);
      expect(faq.mainEntity[i].acceptedAnswer.text).toBe(item.a);
    });
  });

  it('describes a free web application without invented ratings', () => {
    const app = jsonLd(false)['@graph'][1] as Record<string, unknown>;

    expect(app['@type']).toBe('WebApplication');
    expect(app.isAccessibleForFree).toBe(true);
    expect((app.offers as { price: string }).price).toBe('0');
    expect(JSON.stringify(jsonLd(true))).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
  });

  it('can never close its own script element', () => {
    const head = seoHead(false);
    const body = head.slice(head.indexOf('application/ld+json'));

    expect(body.match(/<\/script>/g)).toHaveLength(1);
  });
});

describe('pre-rendered content for crawlers and AI assistants', () => {
  it('contains the H1, every FAQ question and answer, and every feature', () => {
    const html = staticContent(false);

    expect(html).toContain(`<h1>${SITE.h1}</h1>`);
    faqItems(false).forEach((item) => {
      expect(html).toContain(item.q);
      expect(html).toContain(item.a.replace(/&/g, '&amp;'));
    });
    features(false).forEach((f) => expect(html).toContain(f.title));
  });

  it('escapes markup so content can never inject HTML', () => {
    expect(staticContent(true)).not.toMatch(/<script/i);
  });
});

describe('claims match what the build contains', () => {
  const scanned = (ocr: boolean) => faqItems(ocr).find((i) => i.q.includes('scanned'))!.a;

  it('does not promise OCR when the build has no OCR files', () => {
    expect(scanned(false)).toMatch(/not in this build/i);
    expect(features(false).some((f) => /\(OCR\)/.test(f.title))).toBe(false);
  });

  it('promises OCR only when it is bundled, and calls it lower accuracy', () => {
    expect(scanned(true)).toMatch(/runs locally/i);
    expect(scanned(true)).toMatch(/less accurate/i);
    expect(features(true).some((f) => /OCR/.test(f.title))).toBe(true);
  });

  it('keeps llms.txt consistent with the public facts', () => {
    const llms = publicFile('llms.txt');

    expect(llms).toContain(SITE.url);
    expect(llms).toContain(SITE.repo);
    expect(llms).toMatch(/never uploaded/i);
  });
});
