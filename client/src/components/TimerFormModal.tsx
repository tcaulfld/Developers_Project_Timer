import { useMemo, useState, type FormEvent } from 'react';
import type { Bucket, Timer, TimerInput, TimerType } from '../types';

interface Props {
  initial?: Timer | null;
  defaultBucket: Bucket;
  epics: Timer[];
  onClose: () => void;
  onSave: (input: TimerInput, id?: number) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
}

const TYPES: TimerType[] = ['Epic', 'Feature', 'User Story', 'Task'];
const BUCKETS: { id: Bucket; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'future', label: 'Future' },
  { id: 'closed', label: 'Closed' },
];

export function TimerFormModal({
  initial,
  defaultBucket,
  epics,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [projectNumber, setProjectNumber] = useState(
    initial?.projectNumber ?? '',
  );
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState<TimerType>(initial?.type ?? 'Task');
  const [epicId, setEpicId] = useState<number | ''>(initial?.epicId ?? '');
  const [bucket, setBucket] = useState<Bucket>(initial?.bucket ?? defaultBucket);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsEpicLink = type !== 'Epic';

  const epicOptions = useMemo(
    () => epics.filter((e) => e.id !== initial?.id),
    [epics, initial?.id],
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setError('Label is required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(
        {
          label: label.trim(),
          projectNumber: projectNumber.trim() || null,
          description: description.trim() || null,
          type,
          epicId: needsEpicLink && epicId !== '' ? Number(epicId) : null,
          bucket,
        },
        initial?.id,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="modal-header">
          <div>
            <h2>{initial ? 'Edit timer' : 'New timer'}</h2>
            <p>Epic · Feature · User Story · Task — all fields editable.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="form-grid">
          <div className="field full">
            <label htmlFor="label">Label</label>
            <input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Project number and/or description"
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="type">Type</label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as TimerType)}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="bucket">Bucket</label>
            <select
              id="bucket"
              value={bucket}
              onChange={(e) => setBucket(e.target.value as Bucket)}
            >
              {BUCKETS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="projectNumber">Project number</label>
            <input
              id="projectNumber"
              value={projectNumber}
              onChange={(e) => setProjectNumber(e.target.value)}
              placeholder="Links Feature / Story / Task to Epic"
            />
          </div>
          <div className="field">
            <label htmlFor="epicId">Epic</label>
            <select
              id="epicId"
              value={epicId}
              disabled={!needsEpicLink}
              onChange={(e) =>
                setEpicId(e.target.value ? Number(e.target.value) : '')
              }
            >
              <option value="">None</option>
              {epicOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.projectNumber ? `${e.projectNumber} — ` : ''}
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field full">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
        </div>

        <div className="modal-actions">
          {initial && onDelete ? (
            <button
              type="button"
              className="ghost-btn"
              style={{ marginRight: 'auto', color: 'var(--danger)' }}
              disabled={busy}
              onClick={async () => {
                if (!confirm('Delete this timer and its sessions?')) return;
                setBusy(true);
                try {
                  await onDelete(initial.id);
                  onClose();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Delete failed');
                  setBusy(false);
                }
              }}
            >
              Delete
            </button>
          ) : null}
          <button type="button" className="ghost-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-btn" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
