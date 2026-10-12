import { OCR_BUNDLED } from '../../config/build';
import { STEPS, faqItems, features } from '../../content/site';
import { IconLayers, IconReceipt, IconScan, IconShield, IconCheck, IconTable } from '../layout/Icons';

const FEATURE_ICONS: Record<string, JSX.Element> = {
  private: <IconShield />,
  batch: <IconLayers />,
  gst: <IconReceipt />,
  validated: <IconCheck />,
  ocr: <IconScan />,
  export: <IconTable />,
};

export function HowItWorks() {
  return (
    <section id="how-it-works" className="dx-section" aria-labelledby="how-title">
      <div className="dx-container">
        <h2 id="how-title" className="dx-section__title">How it works</h2>
        <ol className="dx-steps">
          {STEPS.map((step, i) => (
            <li key={step.title} className="dx-step">
              <span className="dx-step__num" aria-hidden="true">{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section id="features" className="dx-section dx-section--tint" aria-labelledby="features-title">
      <div className="dx-container">
        <h2 id="features-title" className="dx-section__title">Built for accountants who cannot send invoices to the cloud</h2>
        <ul className="dx-features">
          {features(OCR_BUNDLED).map((feature) => (
            <li key={feature.id} className="dx-feature">
              <span className="dx-feature__icon">{FEATURE_ICONS[feature.id]}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className="dx-section" aria-labelledby="faq-title">
      <div className="dx-container dx-container--narrow">
        <h2 id="faq-title" className="dx-section__title">Frequently asked questions</h2>
        <div className="dx-faq">
          {faqItems(OCR_BUNDLED).map((item) => (
            <details key={item.q} className="dx-faq__item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
