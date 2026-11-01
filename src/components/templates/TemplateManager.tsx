import { useEffect, useRef, useState } from 'react';
import { TemplateStore } from '../../features/templates/templateStore';
import type { VendorTemplate } from '../../features/templates/templateSchema';

const store = new TemplateStore();

type Props = {
  onTemplatesChange?: (templates: VendorTemplate[]) => void;
};

export function TemplateManager({ onTemplatesChange }: Props) {
  const [templates, setTemplates] = useState<VendorTemplate[]>(() => store.load());
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [nameKey, setNameKey] = useState('');
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => onTemplatesChange?.(templates), [onTemplatesChange, templates]);

  const refresh = () => setTemplates(store.list());

  const create = () => {
    try {
      store.save(
        {
          schemaVersion: 1,
          name,
          seller: { gstin: gstin || undefined, nameKey: nameKey || undefined },
          fieldMappings: [],
          tableColumns: [],
        },
        consent,
      );
      setName('');
      setGstin('');
      setNameKey('');
      setConsent(false);
      setNotice('Seller template saved in this browser.');
      refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Template could not be saved.');
    }
  };

  const remove = (id: string) => {
    store.remove(id);
    refresh();
  };

  const exportTemplates = () => {
    const blob = new Blob([store.export()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'docuextract-seller-templates.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importTemplates = async (file?: File) => {
    if (!file) return;
    try {
      store.import(await file.text());
      refresh();
      setNotice('Seller templates imported.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Template import failed.');
    }
  };

  return (
    <section className="dx-template-panel" aria-labelledby="seller-templates-title">
      <div className="dx-locale-panel__group">
        <h2 id="seller-templates-title">Seller templates</h2>
        <p className="dx-locale-panel__hint">
          Templates store matching and reading rules only in this browser. They do not store invoice
          amounts or invoice text. Review remains the final authority.
        </p>
        <div className="dx-template-grid">
          <label>
            Template name
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} />
          </label>
          <label>
            Seller GSTIN (optional)
            <input
              value={gstin}
              onChange={(event) => setGstin(event.target.value)}
              maxLength={160}
            />
          </label>
          <label>
            Seller name key (optional)
            <input
              value={nameKey}
              onChange={(event) => setNameKey(event.target.value)}
              maxLength={160}
            />
          </label>
        </div>
        <label className="dx-template-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          I explicitly agree to save these reading rules in this browser.
        </label>
        <div className="dx-template-actions">
          <button type="button" onClick={create}>
            Save template
          </button>
          <button type="button" onClick={exportTemplates} disabled={!templates.length}>
            Export
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(event) => void importTemplates(event.target.files?.[0])}
          />
        </div>
        {notice && <p role="status">{notice}</p>}
        {templates.length > 0 && (
          <ul className="dx-template-list">
            {templates.map((template) => (
              <li key={template.id}>
                <strong>{template.name}</strong>
                <span>{template.seller.gstin ? ' GSTIN match' : ' Seller-name match'}</span>
                <button type="button" onClick={() => remove(template.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
