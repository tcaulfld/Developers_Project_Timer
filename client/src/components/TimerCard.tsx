import { useEffect, useState } from 'react';
import type { Timer } from '../types';
import { formatDuration } from '../time';

interface Props {
  timer: Timer;
  syncedAt: number;
  onToggle: (timer: Timer) => void;
  onInfo: (timer: Timer) => void;
  onEdit: (timer: Timer) => void;
}

export function TimerCard({ timer, syncedAt, onToggle, onInfo, onEdit }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timer.isRunning) return;
    // Tick often enough to roll HH:MM when a minute elapses.
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timer.isRunning, timer.activeSessionId, syncedAt]);

  const liveMinutes = timer.isRunning
    ? timer.totalMinutes + Math.max(0, Math.floor((now - syncedAt) / 60000))
    : timer.totalMinutes;

  const typeClass =
    timer.type === 'Epic'
      ? 'type-epic'
      : timer.type === 'Feature'
        ? 'type-feature'
        : timer.type === 'User Story'
          ? 'type-story'
          : timer.type === 'Other'
            ? 'type-other'
            : 'type-task';

  return (
    <article
      className={`timer-card${timer.isRunning ? ' running' : ''}`}
      onClick={() => onToggle(timer)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onEdit(timer);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle(timer);
        }
      }}
      aria-label={`${timer.isRunning ? 'Pause' : 'Start'} ${timer.label}`}
    >
      <div className="timer-top">
        <div className="timer-meta">
          <span className={`chip ${typeClass}`}>{timer.type}</span>
          {timer.projectNumber ? (
            <span className="chip">{timer.projectNumber}</span>
          ) : null}
        </div>
        <button
          type="button"
          className="info-btn"
          aria-label="Session details"
          onClick={(e) => {
            e.stopPropagation();
            onInfo(timer);
          }}
        >
          i
        </button>
      </div>
      <h3 className="timer-label">{timer.label}</h3>
      {timer.description ? <p className="timer-sub">{timer.description}</p> : null}
      <div className="timer-footer">
        <span className={`elapsed${timer.isRunning ? ' running' : ''}`}>
          {formatDuration(liveMinutes)}
        </span>
        <span className={`status-dot${timer.isRunning ? ' on' : ''}`} />
      </div>
    </article>
  );
}
