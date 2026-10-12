import { useEffect, useRef, useState } from 'react';
import { MAX_BATCH_FILES, MAX_FILE_BYTES } from '../../config/limits';
import { IconUpload } from '../layout/Icons';

interface Props {
  onFiles: (files: File[]) => void;
}

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/**
 * Multi-file drop zone. Files can be dropped anywhere on the page: while a
 * file is dragged over the window a full-screen overlay confirms the target.
 */
export function FileUploader({ onFiles }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const handler = useRef(onFiles);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    handler.current = onFiles;
  }, [onFiles]);

  useEffect(() => {
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current++;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) handler.current(files);
    };

    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);

    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);

  return (
    <section aria-labelledby="upload-title" className="dx-drop">
      <div className={`dx-drop__zone${dragging ? ' is-over' : ''}`}>
        <span className="dx-drop__icon"><IconUpload /></span>
        <h2 id="upload-title" className="dx-drop__title">Drop invoice PDFs here</h2>
        <p className="dx-drop__hint">
          Up to {MAX_BATCH_FILES} files · {MAX_FILE_BYTES / 1024 / 1024} MB and 100 pages each · processed on your device
        </p>
        <button type="button" className="dx-btn dx-btn--primary dx-btn--lg" onClick={() => input.current?.click()}>
          Choose PDFs
        </button>
        <input
          ref={input}
          className="dx-sr-only"
          type="file"
          multiple
          accept="application/pdf,.pdf"
          aria-label="Choose invoice PDFs"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) onFiles(files);
            e.target.value = '';
          }}
        />
      </div>
      {dragging && (
        <div className="dx-dragveil" aria-hidden="true">
          <div className="dx-dragveil__box">
            <IconUpload />
            <p>Drop PDFs to add them to the batch</p>
          </div>
        </div>
      )}
    </section>
  );
}
