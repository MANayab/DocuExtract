import { FOOTER_LINKS, SITE, STEPS, faqItems, features } from './site';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const abs = (path: string) => new URL(path, SITE.url).toString();

/** JSON-LD graph: WebSite + WebApplication + FAQPage (FAQ text matches the visible page). */
export function jsonLd(ocrBundled: boolean) {
  const faq = faqItems(ocrBundled);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE.url}#website`,
        url: SITE.url,
        name: SITE.name,
        alternateName: ['DocuExtract PDF Invoice to Excel', 'PDF Invoice to Excel Extractor'],
        description: SITE.description,
        inLanguage: 'en',
      },
      {
        '@type': 'WebApplication',
        '@id': `${SITE.url}#app`,
        name: SITE.name,
        url: SITE.url,
        description: SITE.description,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Any (modern web browser)',
        browserRequirements: 'Requires JavaScript and a modern browser',
        softwareVersion: SITE.version,
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        license: 'https://opensource.org/licenses/MIT',
        image: abs('og-image.png'),
        featureList: features(ocrBundled).map((f) => f.title),
        sameAs: [SITE.repo],
        author: { '@type': 'Person', name: SITE.author, url: SITE.authorUrl },
        isPartOf: { '@id': `${SITE.url}#website` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE.url}#faq`,
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  };
}

/** Everything that belongs in <head> for search, social cards and AI assistants. */
export function seoHead(ocrBundled: boolean): string {
  const image = abs('og-image.png');
  const tags = [
    `<title>${esc(SITE.title)}</title>`,
    `<meta name="description" content="${esc(SITE.description)}" />`,
    `<meta name="keywords" content="${esc(SITE.keywords)}" />`,
    `<meta name="author" content="${esc(SITE.author)}" />`,
    `<meta name="application-name" content="${esc(SITE.name)}" />`,
    `<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />`,
    `<meta name="theme-color" content="${SITE.themeColor}" />`,
    `<link rel="canonical" href="${SITE.url}" />`,
    `<link rel="alternate" hreflang="en" href="${SITE.url}" />`,
    `<link rel="alternate" hreflang="x-default" href="${SITE.url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(SITE.name)}" />`,
    `<meta property="og:title" content="${esc(SITE.title)}" />`,
    `<meta property="og:description" content="${esc(SITE.description)}" />`,
    `<meta property="og:url" content="${SITE.url}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="DocuExtract turns PDF invoices into Excel in your browser" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(SITE.title)}" />`,
    `<meta name="twitter:description" content="${esc(SITE.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ];

  if (SITE.googleSiteVerification) {
    tags.push(`<meta name="google-site-verification" content="${esc(SITE.googleSiteVerification)}" />`);
  }

  // "<" is escaped so the JSON can never close its own <script> element.
  const json = JSON.stringify(jsonLd(ocrBundled)).replace(/</g, '\\u003c');
  tags.push(`<script type="application/ld+json">${json}</script>`);

  return tags.join('\n    ');
}

/**
 * Plain semantic HTML placed inside #root. Crawlers and AI assistants that do
 * not run JavaScript read this; React replaces it as soon as the app loads.
 */
export function staticContent(ocrBundled: boolean): string {
  const faq = faqItems(ocrBundled)
    .map((item) => `<details><summary>${esc(item.q)}</summary><p>${esc(item.a)}</p></details>`)
    .join('');

  return [
    '<div class="dx-static" data-prerendered="true">',
    `<header><strong>${esc(SITE.name)}</strong></header>`,
    '<main>',
    `<h1>${esc(SITE.h1)}</h1>`,
    `<p>${esc(SITE.description)}</p>`,
    '<h2>How it works</h2>',
    `<ol>${STEPS.map((s) => `<li><strong>${esc(s.title)}.</strong> ${esc(s.body)}</li>`).join('')}</ol>`,
    '<h2>Features</h2>',
    `<ul>${features(ocrBundled).map((f) => `<li><strong>${esc(f.title)}.</strong> ${esc(f.body)}</li>`).join('')}</ul>`,
    '<h2>Frequently asked questions</h2>',
    faq,
    '</main>',
    `<footer>${FOOTER_LINKS.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join(' · ')}</footer>`,
    '</div>',
  ].join('');
}
