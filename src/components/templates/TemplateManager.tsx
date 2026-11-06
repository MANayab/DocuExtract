import { useEffect, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import { TemplateStore } from '../../features/templates/templateStore';
import type { VendorTemplate } from '../../features/templates/templateSchema';

const store = new TemplateStore();

type Props = {
  onTemplatesChange?: (templates: VendorTemplate[]) => void;
};

export function TemplateManager({ onTemplatesChange }: Props) {
  const [templates, setTemplates] = useState<VendorTemplate[]>(() => store.load());
  const [name, setName] = useState('');
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
          seller: { nameKey },
          fieldMappings: [],
          tableColumns: [],
        },
        consent,
      );
      setName('');
      setNameKey('');
      setConsent(false);
      setNotice('Seller matching profile saved in this browser.');
      refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Seller profile could not be saved.');
    }
  };

  const remove = (id: string) => {
    store.remove(id);
    refresh();
  };

  const exportTemplates = () => {
    const blob = new Blob([store.export()], { type: 'application/json' });
    saveAs(blob, 'docuextract-seller-templates.json');
  };

  const importTemplates = async (file?: File) => {
    if (!file) return;
    try {
      const imported = store.import(await file.text(), consent);
      setConsent(false);
      refresh();
      setNotice(`${imported} seller profile${imported === 1 ? '' : 's'} imported.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Seller profile import failed.');
    }
  };

  return (
    <section className="dx-template-panel" aria-labelledby="seller-templates-title">
      <div className="dx-locale-panel__group">
        <h2 id="seller-templates-title">Seller matching profiles</h2>
        <p className="dx-locale-panel__hint">
          Profiles store a seller name matching key in this browser after explicit consent. They do
          not store seller tax IDs or invoice values. Custom field and table reading rules are not
          connected to the extraction parser yet; review every extracted field.
        </p>
        <div className="dx-template-grid">
          <label>
            Profile name
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} />
          </label>
          <label>
            Seller name key
            <input
              required
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
          I explicitly agree to save or import these seller matching profiles in this browser.
        </label>
        <div className="dx-template-actions">
          <button type="button" onClick={create} disabled={!consent}>
            Save profile
          </button>
          <button type="button" onClick={exportTemplates} disabled={!templates.length}>
            Export
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={!consent}>
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
                <span> Seller-name match only</span>
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
