import { SITE } from '../../content/site';
import { IconGithub, Logo } from './Icons';

export function Header({ onHome }: { onHome: () => void }) {
  return (
    <header className="dx-header">
      <div className="dx-container dx-header__inner">
        <button type="button" className="dx-brand" onClick={onHome} aria-label={`${SITE.name} home`}>
          <Logo />
          <span>{SITE.name}</span>
        </button>
        <nav aria-label="Primary" className="dx-nav">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
          <a className="dx-nav__gh" href={SITE.repo} target="_blank" rel="noopener noreferrer">
            <IconGithub />
            <span>GitHub</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
