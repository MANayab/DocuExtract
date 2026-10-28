import { useEffect, useMemo, useRef, useState } from 'react';
import { ErrorPanel } from '../components/ErrorPanel';
import { ExportPanel } from '../components/ExportPanel';
import { FileUploader } from '../components/FileUploader';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { IconCheck, IconShield, IconSparkle } from '../components/layout/Icons';
import { Features, Faq, HowItWorks } from '../components/marketing/Sections';
import { KpiCards } from '../components/Dashboard/KpiCards';
import { ResultsTable } from '../components/Dashboard/ResultsTable';
import { ReviewScreen } from '../components/review/ReviewScreen';
import { OCR_BUNDLED } from '../config/build';
import { LOCALES, type LocaleCode } from '../config/locales';
import { SITE } from '../content/site';
import { useBatchStore, useOcrAvailable } from '../features/batch/useBatch';
import { findDuplicates, summarize } from '../features/batch/summary';
import type { ExportEntry } from '../features/export/workbookModel';
import { analyzeInvoice } from '../features/validation/analysis';
import type { Invoice } from '../types/invoice';

type View = { kind: 'dashboard' } | { kind: 'review'; id: string };

export function App() {
  const { store, records } = useBatchStore();
  const ocrAvailable = useOcrAvailable();
  const [view, setView] = useState<View>({ kind: 'dashboard' });
  const [notices, setNotices] = useState<string[]>([]);
  const [locale, setLocale] = useState<LocaleCode>(() => store.getLocale());
  const autoOpen = useRef(false);

  const summary = useMemo(() => summarize(records), [records]);
  const duplicates = useMemo(() => findDuplicates(records), [records]);

  const ready = useMemo(() => records.filter((r) => r.status === 'ready' && r.invoice), [records]);
  const entries: ExportEntry[] = useMemo(
    () =>
      ready.map((r) => ({
        invoice: r.invoice as Invoice,
        checks: analyzeInvoice(r.invoice as Invoice).checks,
      })),
    [ready],
  );

  const handleFiles = (files: File[]) => {
    const wasEmpty = store.getSnapshot().length === 0;
    const result = store.addFiles(files);

    setNotices(result.rejected.map((r) => `${r.name}: ${r.reason}`));
    // A single dropped file goes straight to review, like a one-off converter.
    autoOpen.current = wasEmpty && files.length === 1 && result.accepted === 1;
  };

  useEffect(() => {
    if (!autoOpen.current || records.length === 0) return;

    if (records.length === 1 && records[0].status === 'ready') {
      autoOpen.current = false;
      setView({ kind: 'review', id: records[0].id });
    } else if (
      records.some((r) => r.status === 'error' || r.status === 'needs-ocr') ||
      records.length > 1
    ) {
      autoOpen.current = false;
    }
  }, [records]);

  const current = view.kind === 'review' ? records.find((r) => r.id === view.id) : undefined;
  const reviewing = current?.invoice ? current : undefined;
  const readyIds = ready.map((r) => r.id);
  const position = reviewing ? readyIds.indexOf(reviewing.id) : -1;

  const goHome = () => setView({ kind: 'dashboard' });

  if (reviewing?.invoice) {
    const invoice = reviewing.invoice;

    return (
      <div className="dx-app">
        <Header onHome={goHome} />
        <main id="main">
          <ReviewScreen
            record={reviewing}
            invoice={invoice}
            analysis={analyzeInvoice(invoice)}
            position={{ index: position + 1, total: readyIds.length }}
            onBack={goHome}
            onPrev={
              position > 0
                ? () => setView({ kind: 'review', id: readyIds[position - 1] })
                : undefined
            }
            onNext={
              position < readyIds.length - 1
                ? () => setView({ kind: 'review', id: readyIds[position + 1] })
                : undefined
            }
            onChange={(next) => store.updateInvoice(reviewing.id, next)}
            locale={locale}
            onLocaleChange={(next) => {
              setLocale(next);
              store.setLocale(next);
            }}
            canReprocess={store.canReprocess(reviewing.id)}
            onReprocess={() => {
              if (
                !window.confirm(
                  'Reprocess this invoice using the selected locale? This will replace extracted values for this invoice. Manual edits are protected; edited invoices cannot be reprocessed.',
                )
              )
                return;
              void store.reprocessWithLocale(reviewing.id, locale).then((success) => {
                setNotices((current) => [
                  ...current,
                  success
                    ? 'Invoice reprocessed with the selected locale.'
                    : 'Reprocessing was not completed; the existing invoice was preserved.',
                ]);
              });
            }}
          />
        </main>
        <Footer />
      </div>
    );
  }

  const hasRecords = records.length > 0;

  return (
    <div className="dx-app">
      <a className="dx-skip" href="#main">
        Skip to content
      </a>
      <Header onHome={goHome} />

      <main id="main">
        <section className="dx-hero">
          <div className="dx-container dx-hero__inner">
            <p className="dx-eyebrow">
              <IconSparkle /> v{SITE.version} · batch, GST
              {OCR_BUNDLED ? ' and OCR' : ' and multi-invoice PDFs'}
            </p>
            <h1 className="dx-hero__title">{SITE.h1}</h1>
            <p className="dx-hero__lead">
              {SITE.tagline}. Drop invoices, check what was flagged and download Excel, CSV or JSON.
              Nothing is uploaded.
            </p>
            <ul className="dx-trust" aria-label="Highlights">
              <li>
                <IconShield /> No upload, no account
              </li>
              <li>
                <IconCheck /> Totals and tax validated
              </li>
              <li>
                <IconCheck /> Free and open source
              </li>
            </ul>
          </div>
        </section>

        <div className="dx-container dx-lift">
          {notices.length > 0 && (
            <div className="dx-notices">
              {notices.map((message) => (
                <ErrorPanel
                  key={message}
                  message={message}
                  onDismiss={() => setNotices((all) => all.filter((m) => m !== message))}
                />
              ))}
            </div>
          )}

          <section className="dx-panel dx-locale-panel" aria-labelledby="locale-heading">
            <div className="dx-locale-panel__field">
              <div className="dx-locale-panel__copy">
                <h2 id="locale-heading">Number and date format</h2>
                <label htmlFor="invoice-locale">Invoice locale</label>
              </div>
              <select
                id="invoice-locale"
                value={locale}
                onChange={(event) => {
                  const next = event.target.value as LocaleCode;
                  setLocale(next);
                  store.setLocale(next);
                }}
              >
                {Object.values(LOCALES).map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="dx-locale-panel__hint">
              Controls how ambiguous dates and number separators are interpreted. Review financial
              data before relying on it.
            </p>
          </section>

          <FileUploader onFiles={handleFiles} />

          {hasRecords && (
            <div className="dx-stack dx-dashboard">
              <KpiCards summary={summary} />
              <ResultsTable
                records={records}
                duplicates={duplicates}
                ocrAvailable={ocrAvailable}
                onOpen={(id) => setView({ kind: 'review', id })}
                onRemove={(id) => store.remove(id)}
                onOcr={(id) => store.requestOcr(id)}
                onClear={() => store.clear()}
              />
              <ExportPanel entries={entries} scope="all" flagged={summary.needsReview} />
            </div>
          )}
        </div>

        <HowItWorks />
        <Features />
        <Faq />
      </main>

      <Footer />
    </div>
  );
}
