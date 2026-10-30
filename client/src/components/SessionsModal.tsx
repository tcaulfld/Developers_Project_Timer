import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { Session, Timer, UserStoryWorkLabel } from '../types';
import { USER_STORY_WORK_LABELS } from '../types';
import { formatDateTimeCst, toSqlDate } from '../time';

interface Props {
  timer: Timer;
  onClose: () => void;
  onChanged: () => void;
  onEditTimer: (timer: Timer) => void;
}

export function SessionsModal({ timer, onClose, onChanged, onEditTimer }: Props) {
  const isUserStory = timer.type === 'User Story';
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Session | null>(null);
  const [startedAt, setStartedAt] = useState('');
  const [endedAt, setEndedAt] = useState('');
  const [workLabel, setWorkLabel] = useState<UserStoryWorkLabel | ''>('');
  const [newWorkLabel, setNewWorkLabel] = useState<UserStoryWorkLabel | ''>('');

  async function load() {
    try {
      setSessions(await api.listSessions(timer.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    }
  }

  useEffect(() => {
    void load();
  }, [timer.id]);

  function openEdit(s: Session) {
    setEditing(s);
    setStartedAt(toLocalInput(s.startedAt));
    setEndedAt(s.endedAt ? toLocalInput(s.endedAt) : '');
    setWorkLabel(s.workLabel ?? '');
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      await api.updateSession(editing.id, {
        startedAt: fromLocalInput(startedAt),
        endedAt: endedAt ? fromLocalInput(endedAt) : null,
        ...(isUserStory
          ? { workLabel: workLabel === '' ? null : workLabel }
          : { workLabel: null }),
      });
      setEditing(null);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Sessions</h2>
            <p>
              {timer.label}
              {timer.projectNumber ? ` · ${timer.projectNumber}` : ''}
              {isUserStory ? ' · User Story labels' : ''}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        {editing ? (
          <form onSubmit={saveEdit} className="form-grid" style={{ marginBottom: 16 }}>
            <div className="field">
              <label htmlFor="started">Start</label>
              <input
                id="started"
                type="datetime-local"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="ended">End (empty = still active)</label>
              <input
                id="ended"
                type="datetime-local"
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
              />
            </div>
            <div className="field full">
              <label htmlFor="workLabel">Work label</label>
              <select
                id="workLabel"
                value={workLabel}
                disabled={!isUserStory}
                onChange={(e) =>
                  setWorkLabel((e.target.value || '') as UserStoryWorkLabel | '')
                }
              >
                <option value="">
                  {isUserStory ? 'None' : 'N/A (User Story only)'}
                </option>
                {USER_STORY_WORK_LABELS.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-actions full">
              <button type="button" className="ghost-btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="primary-btn">
                Save period
              </button>
            </div>
          </form>
        ) : null}

        <div className="session-list">
          {sessions.length === 0 ? (
            <div className="empty-state">
              <h2>No sessions yet</h2>
              <p>Tap the timer card to start counting.</p>
            </div>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="session-row">
                <div className="times">
                  <div>{formatDateTimeCst(s.startedAt)}</div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    → {s.endedAt ? formatDateTimeCst(s.endedAt) : 'Active now'}
                    {s.workLabel ? (
                      <span className="chip" style={{ marginLeft: 8 }}>
                        {s.workLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="actions">
                  <button type="button" className="ghost-btn" onClick={() => openEdit(s)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={async () => {
                      if (!confirm('Delete this session?')) return;
                      await api.deleteSession(s.id);
                      await load();
                      onChanged();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {isUserStory ? (
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="newWorkLabel">Label for new session</label>
            <select
              id="newWorkLabel"
              value={newWorkLabel}
              onChange={(e) =>
                setNewWorkLabel((e.target.value || '') as UserStoryWorkLabel | '')
              }
            >
              <option value="">None</option>
              {USER_STORY_WORK_LABELS.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="modal-actions">
          <button
            type="button"
            className="ghost-btn"
            style={{ marginRight: 'auto' }}
            onClick={() => {
              onEditTimer(timer);
              onClose();
            }}
          >
            Edit timer
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={async () => {
              const now = new Date();
              const earlier = new Date(now.getTime() - 60 * 60 * 1000);
              await api.createSession({
                timerId: timer.id,
                startedAt: toSqlDate(earlier),
                endedAt: toSqlDate(now),
                workLabel: isUserStory
                  ? newWorkLabel === ''
                    ? null
                    : newWorkLabel
                  : null,
              });
              await load();
              onChanged();
            }}
          >
            Add 1h session
          </button>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function toLocalInput(sql: string): string {
  const d = new Date(sql.includes('T') ? sql : sql.replace(' ', 'T') + 'Z');
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string {
  return toSqlDate(new Date(local));
}
