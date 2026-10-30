import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { CalendarView } from './components/CalendarView';
import { SessionsModal } from './components/SessionsModal';
import { SettingsModal } from './components/SettingsModal';
import { TimerCard } from './components/TimerCard';
import { TimerFormModal } from './components/TimerFormModal';
import type { Bucket, Settings, Timer, TimerInput } from './types';

type Theme = 'dark' | 'light';

const BUCKETS: { id: Bucket; label: string }[] = [
  { id: 'closed', label: 'Closed' },
  { id: 'open', label: 'Open' },
  { id: 'future', label: 'Future' },
];

export default function App() {
  const [bucket, setBucket] = useState<Bucket>('open');
  const [timers, setTimers] = useState<Timer[]>([]);
  const [settings, setSettings] = useState<Settings>({
    allowMultipleActive: false,
  });
  const [syncedAt, setSyncedAt] = useState(() => Date.now());
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('dpt-theme');
    return saved === 'light' ? 'light' : 'dark';
  });
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editTimer, setEditTimer] = useState<Timer | null>(null);
  const [sessionsTimer, setSessionsTimer] = useState<Timer | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('dpt-theme', theme);
  }, [theme]);

  const refresh = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([api.listTimers(), api.getSettings()]);
      setTimers(t);
      setSettings(s);
      setSyncedAt(Date.now());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const visible = useMemo(
    () => timers.filter((t) => t.bucket === bucket),
    [timers, bucket],
  );
  const epics = useMemo(() => timers.filter((t) => t.type === 'Epic'), [timers]);

  async function toggleTimer(timer: Timer) {
    try {
      if (timer.isRunning) await api.pauseTimer(timer.id);
      else await api.startTimer(timer.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Timer action failed');
    }
  }

  async function saveTimer(input: TimerInput, id?: number) {
    if (id) await api.updateTimer(id, input);
    else await api.createTimer(input);
    await refresh();
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-name">Developer's Timer</div>
          <div className="brand-tag">Project focus · touch-ready</div>
        </div>

        <nav className="bucket-tabs" aria-label="Buckets">
          {BUCKETS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`bucket-tab${bucket === b.id ? ' active' : ''}`}
              onClick={() => setBucket(b.id)}
            >
              {b.label}
            </button>
          ))}
        </nav>

        <div className="top-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label="Toggle theme"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setShowSettings(true)}
          >
            Settings
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              setEditTimer(null);
              setShowForm(true);
            }}
          >
            + New
          </button>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <main className="main">
        {visible.length === 0 ? (
          <div className="empty-state">
            <h2>No {bucket} timers</h2>
            <p>Create one in this bucket, or move an existing timer here.</p>
          </div>
        ) : (
          <div className="timer-grid">
            {visible.map((t) => (
              <TimerCard
                key={t.id}
                timer={t}
                syncedAt={syncedAt}
                onToggle={toggleTimer}
                onInfo={(timer) => setSessionsTimer(timer)}
                onEdit={(timer) => {
                  setEditTimer(timer);
                  setShowForm(true);
                }}
              />
            ))}
          </div>
        )}
      </main>

      <div className="dock">
        <button
          type="button"
          className="primary-btn"
          onClick={() => setShowCalendar(true)}
        >
          Week calendar
        </button>
      </div>

      {showForm ? (
        <TimerFormModal
          initial={editTimer}
          defaultBucket={bucket}
          epics={epics}
          onClose={() => {
            setShowForm(false);
            setEditTimer(null);
          }}
          onSave={saveTimer}
          onDelete={async (id) => {
            await api.deleteTimer(id);
            await refresh();
          }}
        />
      ) : null}

      {sessionsTimer ? (
        <SessionsModal
          timer={sessionsTimer}
          onClose={() => setSessionsTimer(null)}
          onChanged={refresh}
          onEditTimer={(timer) => {
            setEditTimer(timer);
            setShowForm(true);
          }}
        />
      ) : null}

      {showCalendar ? <CalendarView onClose={() => setShowCalendar(false)} /> : null}

      {showSettings ? (
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettings(false)}
          onToggleMulti={async (value) => {
            setSettings(await api.updateSettings(value));
          }}
        />
      ) : null}
    </div>
  );
}
