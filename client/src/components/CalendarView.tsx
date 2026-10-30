import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { api } from '../api';
import type { Session } from '../types';
import {
  BUSINESS_END,
  BUSINESS_START,
  addDays,
  chicagoYmd,
  parseSqlDate,
  sprintsOverlapping,
  startOfWorkWeek,
  toSqlDate,
} from '../time';

interface Props {
  onClose: () => void;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DEFAULT_START_MIN = BUSINESS_START.h * 60 + BUSINESS_START.m; // 8:30
const DEFAULT_END_MIN = BUSINESS_END.h * 60 + BUSINESS_END.m; // 17:00

export function CalendarView({ onClose }: Props) {
  const [anchor, setAnchor] = useState(() => startOfWorkWeek(new Date()));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);

  const weekStart = useMemo(() => startOfWorkWeek(anchor), [anchor]);
  // Always fetch Mon–Sun so we can decide whether Sat/Sun columns are needed.
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const startYmd = chicagoYmd(weekStart);
  const endYmd = chicagoYmd(addDays(weekStart, 6));
  const sprints = sprintsOverlapping(startYmd, endYmd);

  useEffect(() => {
    const start = toSqlDate(new Date(`${startYmd}T00:00:00-06:00`));
    const end = toSqlDate(new Date(`${endYmd}T23:59:59-06:00`));
    api
      .calendarSessions(start, end)
      .then(setSessions)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Calendar load failed'),
      );
  }, [startYmd, endYmd]);

  const visible = useMemo(
    () => computeVisibleWindow(sessions, weekDays),
    [sessions, weekDays],
  );

  const hourLabels = useMemo(
    () => buildHourLabels(visible.gridStartMin, visible.gridEndMin),
    [visible.gridStartMin, visible.gridEndMin],
  );

  const rangeNote = visible.expanded
    ? `CST · 8:30 AM–5:00 PM default · expanded ${formatMinutesLabel(visible.gridStartMin)}–${formatMinutesLabel(visible.gridEndMin)} for sessions this week`
    : 'CST · 8:30 AM–5:00 PM (expands only when sessions fall outside)';

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Work week</h2>
            <p>{rangeNote}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="calendar-toolbar">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setAnchor(addDays(weekStart, -7))}
          >
            ← Prev week
          </button>
          <h3>
            {startYmd} → {chicagoYmd(addDays(weekStart, 4))}
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setAnchor(startOfWorkWeek(new Date()))}
            >
              This week
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setAnchor(addDays(weekStart, 7))}
            >
              Next week →
            </button>
          </div>
        </div>

        <div className="sprint-banner">
          {sprints.map((s) => (
            <span key={s.id} className="sprint-pill">
              {s.label}: {s.startYmd} → {s.endYmd}
            </span>
          ))}
          {sprints.length === 0 ? (
            <span className="sprint-pill">No sprint markers this week</span>
          ) : null}
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <div
          className="week-grid"
          style={{
            gridTemplateColumns: `72px repeat(${visible.dayIndexes.length}, 1fr)`,
          }}
        >
          <div className="time-rail">
            <div className="day-head">CST</div>
            {hourLabels.map((h) => (
              <div key={h.key} className="time-label" style={{ flex: h.flex }}>
                {h.label}
              </div>
            ))}
          </div>

          {visible.dayIndexes.map((idx) => {
            const day = weekDays[idx];
            const ymd = chicagoYmd(day);
            const isSprintStart = sprints.some((s) => s.startYmd === ymd);
            const isSprintEnd = sprints.some((s) => s.endYmd === ymd);
            const daySessions = sessions.filter((s) => sessionTouchesDay(s, ymd));

            return (
              <div key={ymd} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div
                  className={`day-head${isSprintStart || isSprintEnd ? ' sprint-edge' : ''}`}
                >
                  {DAY_NAMES[idx]}
                  <span className="sub">
                    {ymd.slice(5)}
                    {isSprintStart ? ' · sprint start' : ''}
                    {isSprintEnd ? ' · sprint end' : ''}
                  </span>
                </div>
                <div className="day-col" style={{ flex: 1 }}>
                  {daySessions.map((s) => {
                    const style = blockStyle(
                      s,
                      ymd,
                      visible.gridStartMin,
                      visible.gridEndMin,
                    );
                    if (!style) return null;
                    const colors = colorForTimer(s.timerId);
                    const name = (s.projectNumber || s.timerLabel || 'Timer').trim();
                    return (
                      <div
                        key={s.id}
                        className="cal-block"
                        style={{
                          ...style,
                          background: colors.bg,
                          borderColor: colors.border,
                        }}
                        title={name}
                      >
                        {name}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface VisibleWindow {
  dayIndexes: number[];
  gridStartMin: number;
  gridEndMin: number;
  expanded: boolean;
}

function computeVisibleWindow(sessions: Session[], weekDays: Date[]): VisibleWindow {
  // Default: Mon–Fri (indexes 0–4)
  const dayNeeded = new Set<number>([0, 1, 2, 3, 4]);
  let gridStartMin = DEFAULT_START_MIN;
  let gridEndMin = DEFAULT_END_MIN;

  for (const s of sessions) {
    for (let idx = 0; idx < weekDays.length; idx++) {
      const ymd = chicagoYmd(weekDays[idx]);
      if (!sessionTouchesDay(s, ymd)) continue;
      dayNeeded.add(idx);

      const { startMin, endMin } = sessionMinutesOnDay(s, ymd);
      if (endMin <= startMin) continue;
      gridStartMin = Math.min(gridStartMin, startMin);
      gridEndMin = Math.max(gridEndMin, endMin);
    }
  }

  // Snap expansion to sensible minute boundaries (keep default tight when unused).
  gridStartMin = Math.max(0, Math.floor(gridStartMin / 30) * 30);
  gridEndMin = Math.min(24 * 60, Math.ceil(gridEndMin / 30) * 30);
  if (gridEndMin <= gridStartMin) {
    gridStartMin = DEFAULT_START_MIN;
    gridEndMin = DEFAULT_END_MIN;
  }

  const dayIndexes = [...dayNeeded].sort((a, b) => a - b);
  const expanded =
    gridStartMin < DEFAULT_START_MIN ||
    gridEndMin > DEFAULT_END_MIN ||
    dayIndexes.some((i) => i > 4);

  return { dayIndexes, gridStartMin, gridEndMin, expanded };
}

function sessionMinutesOnDay(
  s: Session,
  ymd: string,
): { startMin: number; endMin: number } {
  const start = parseSqlDate(s.startedAt);
  const end = parseSqlDate(s.endedAt ?? new Date().toISOString());
  let startMin = minutesFromMidnightCst(start);
  let endMin = minutesFromMidnightCst(end);
  if (chicagoYmd(start) < ymd) startMin = 0;
  if (chicagoYmd(end) > ymd) endMin = 24 * 60;
  // Same-calendar-day midnight end
  if (endMin === 0 && chicagoYmd(end) === ymd && end > start) endMin = 24 * 60;
  return { startMin, endMin };
}

/** Stable HSL palette per timer id so overlapping blocks stay distinguishable. */
function colorForTimer(timerId: number): { bg: string; border: string } {
  const hue = ((Number(timerId) || 0) * 47) % 360;
  return {
    bg: `hsla(${hue}, 52%, 38%, 0.72)`,
    border: `hsla(${hue}, 65%, 58%, 0.95)`,
  };
}

function buildHourLabels(gridStartMin: number, gridEndMin: number) {
  const span = Math.max(gridEndMin - gridStartMin, 30);
  // Aim for ~5–7 labels across the visible window.
  const step = span <= 240 ? 30 : span <= 480 ? 60 : 120;
  const labels: { key: string; label: string; flex: number }[] = [];
  let t = gridStartMin;
  while (t < gridEndMin) {
    const next = Math.min(t + step, gridEndMin);
    labels.push({
      key: String(t),
      label: formatMinutesLabel(t),
      flex: Math.max(1, next - t),
    });
    t = next;
  }
  if (labels.length === 0) {
    labels.push({
      key: 'start',
      label: formatMinutesLabel(gridStartMin),
      flex: 1,
    });
  }
  return labels;
}

function formatMinutesLabel(mins: number): string {
  const clamped = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(clamped / 60);
  const m = clamped % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function sessionTouchesDay(s: Session, ymd: string): boolean {
  const start = chicagoYmd(parseSqlDate(s.startedAt));
  const end = chicagoYmd(parseSqlDate(s.endedAt ?? new Date().toISOString()));
  return start <= ymd && end >= ymd;
}

function minutesFromMidnightCst(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  let hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  // Some engines emit 24 for midnight
  if (hour === 24) hour = 0;
  return hour * 60 + minute;
}

function blockStyle(
  s: Session,
  ymd: string,
  gridStartMin: number,
  gridEndMin: number,
): CSSProperties | null {
  const { startMin: rawStart, endMin: rawEnd } = sessionMinutesOnDay(s, ymd);
  const startMin = Math.max(rawStart, gridStartMin);
  const endMin = Math.min(rawEnd, gridEndMin);
  if (endMin <= startMin) return null;

  const span = gridEndMin - gridStartMin;
  const top = ((startMin - gridStartMin) / span) * 100;
  const height = ((endMin - startMin) / span) * 100;
  return {
    top: `${top}%`,
    height: `${Math.max(height, 3)}%`,
  };
}
