import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { api } from '../api';
import type { Session } from '../types';
import {
  AFTER_HOURS_DAYS,
  AFTER_HOURS_END,
  AFTER_HOURS_START,
  BUSINESS_END,
  BUSINESS_START,
  addDays,
  chicagoYmd,
  formatTimeCst,
  parseSqlDate,
  sprintsOverlapping,
  startOfWorkWeek,
  toSqlDate,
} from '../time';

interface Props {
  onClose: () => void;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarView({ onClose }: Props) {
  const [anchor, setAnchor] = useState(() => startOfWorkWeek(new Date()));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);

  const weekStart = useMemo(() => startOfWorkWeek(anchor), [anchor]);
  const days = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const startYmd = chicagoYmd(weekStart);
  const endYmd = chicagoYmd(addDays(weekStart, 5));
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

  const hourLabels = useMemo(() => buildHourLabels(), []);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Work week</h2>
            <p>CST · 8:30 AM–5:00 PM · After-hours Thu/Fri/Sat 9:00 PM–12:00 AM</p>
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

        <div className="week-grid with-sat">
          <div className="time-rail">
            <div className="day-head">CST</div>
            {hourLabels.map((h) => (
              <div key={h.key} className="time-label" style={{ flex: h.flex }}>
                {h.label}
              </div>
            ))}
          </div>

          {days.map((day, idx) => {
            const ymd = chicagoYmd(day);
            const isSprintStart = sprints.some((s) => s.startYmd === ymd);
            const isSprintEnd = sprints.some((s) => s.endYmd === ymd);
            const dow = idx + 1;
            const showAfter = AFTER_HOURS_DAYS.has(dow);
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
                <div
                  className={`day-col${showAfter ? ' after-hours-zone' : ''}`}
                  style={{ flex: 1 }}
                >
                  {daySessions.map((s) => {
                    const style = blockStyle(s, ymd, showAfter);
                    if (!style) return null;
                    return (
                      <div key={s.id} className="cal-block" style={style}>
                        {s.projectNumber ? `${s.projectNumber} · ` : ''}
                        {s.timerLabel}
                        <div style={{ opacity: 0.8, fontWeight: 500 }}>
                          {formatTimeCst(s.startedAt)}
                          {s.endedAt ? `–${formatTimeCst(s.endedAt)}` : '→'}
                        </div>
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

function buildHourLabels() {
  return [
    { key: '830', label: '8:30 AM', flex: 2 },
    { key: '10', label: '10:00 AM', flex: 2 },
    { key: '12', label: '12:00 PM', flex: 2 },
    { key: '14', label: '2:00 PM', flex: 2 },
    { key: '17', label: '5:00 PM', flex: 1 },
    { key: '21', label: '9:00 PM', flex: 1 },
    { key: '00', label: '12:00 AM', flex: 1 },
  ];
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
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function blockStyle(
  s: Session,
  ymd: string,
  showAfter: boolean,
): CSSProperties | null {
  const start = parseSqlDate(s.startedAt);
  const end = parseSqlDate(s.endedAt ?? new Date().toISOString());
  const dayStartMin = BUSINESS_START.h * 60 + BUSINESS_START.m;
  const dayEndMin = showAfter
    ? AFTER_HOURS_END.h * 60 + AFTER_HOURS_END.m
    : BUSINESS_END.h * 60 + BUSINESS_END.m;
  const bizSpan = BUSINESS_END.h * 60 + BUSINESS_END.m - dayStartMin;
  const afterSpan =
    AFTER_HOURS_END.h * 60 +
    AFTER_HOURS_END.m -
    (AFTER_HOURS_START.h * 60 + AFTER_HOURS_START.m);

  let startMin = minutesFromMidnightCst(start);
  let endMin = minutesFromMidnightCst(end);
  if (chicagoYmd(start) < ymd) startMin = dayStartMin;
  if (chicagoYmd(end) > ymd) endMin = dayEndMin;

  startMin = Math.max(startMin, dayStartMin);
  endMin = Math.min(endMin, dayEndMin);
  if (endMin <= startMin) return null;

  const toPct = (m: number) => {
    if (m <= BUSINESS_END.h * 60 + BUSINESS_END.m) {
      return ((m - dayStartMin) / bizSpan) * 72;
    }
    if (!showAfter) return 72;
    const afterStart = AFTER_HOURS_START.h * 60 + AFTER_HOURS_START.m;
    if (m < afterStart) return 72;
    return 72 + ((m - afterStart) / afterSpan) * 28;
  };

  const top = toPct(startMin);
  const bottom = toPct(endMin);
  return {
    top: `${top}%`,
    height: `${Math.max(bottom - top, 3)}%`,
  };
}
