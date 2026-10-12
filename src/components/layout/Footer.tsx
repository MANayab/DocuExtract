import { FOOTER_LINKS, SITE } from '../../content/site';

export function Footer() {
  return (
    <footer className="dx-footer">
      <div className="dx-container dx-footer__inner">
        <div>
          <strong>{SITE.name}</strong> <span className="dx-muted">v{SITE.version} · MIT licensed</span>
          <p className="dx-muted dx-footer__note">
            Extraction is heuristic. Review all extracted values before accounting, tax or payment use.
          </p>
        </div>
        <nav aria-label="Footer" className="dx-footer__links">
          {FOOTER_LINKS.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
