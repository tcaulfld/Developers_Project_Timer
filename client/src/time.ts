/** America/Chicago (CST/CDT) helpers for calendar + display. */

const TZ = 'America/Chicago';

/**
 * Resolve whole minutes from a timer payload.
 * Prefers totalMinutes; falls back to totalSeconds for older API responses.
 */
export function minutesFromTimer(timer: {
  totalMinutes?: number | null;
  totalSeconds?: number | null;
}): number {
  const mins = Number(timer.totalMinutes);
  if (Number.isFinite(mins)) return Math.max(0, Math.floor(mins));
  const secs = Number(timer.totalSeconds);
  if (Number.isFinite(secs)) return Math.max(0, Math.floor(secs / 60));
  return 0;
}

/** Format whole minutes as HH:MM (no seconds). Never returns NaN:NaN. */
export function formatDuration(totalMinutes: number): string {
  const n = Number(totalMinutes);
  const mins = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseSqlDate(value: string): Date {
  if (value.includes('T')) return new Date(value);
  return new Date(value.replace(' ', 'T') + 'Z');
}

export function toSqlDate(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

export function formatDateTimeCst(value: string): string {
  const d = parseSqlDate(value);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/** 12-hour clock with AM/PM, e.g. "8:30 AM". */
export function formatTimeCst(value: string | Date): string {
  const d = typeof value === 'string' ? parseSqlDate(value) : value;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/** Monday of the work week containing `anchor` (CST calendar day). */
export function startOfWorkWeek(anchor: Date): Date {
  const parts = chicagoYmd(anchor);
  const localNoon = new Date(`${parts}T12:00:00`);
  // Use CST weekday via formatter
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
  }).format(anchor);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offset = map[weekday] ?? 0;
  const monday = new Date(localNoon);
  monday.setDate(monday.getDate() - offset);
  return monday;
}

export function chicagoYmd(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * Sprints are Wed–Tue (10 business days).
 * Q4 Sprint 3 starts 2026-11-04 (Wednesday).
 */
export const SPRINT3_START = '2026-11-04';

export interface SprintMarker {
  id: string;
  label: string;
  startYmd: string;
  endYmd: string;
}

export function sprintsOverlapping(weekStartYmd: string, weekEndYmd: string): SprintMarker[] {
  const base = new Date(`${SPRINT3_START}T12:00:00`);
  // Sprint 3 is index 0; generate nearby sprints (±8)
  const markers: SprintMarker[] = [];
  for (let i = -8; i <= 8; i++) {
    const start = addDays(base, i * 14);
    const end = addDays(start, 13); // Wed through following Tue
    const startYmd = chicagoYmd(start);
    const endYmd = chicagoYmd(end);
    if (startYmd <= weekEndYmd && endYmd >= weekStartYmd) {
      const sprintNum = 3 + i;
      const q = quarterLabel(start);
      markers.push({
        id: `${q}-s${sprintNum}`,
        label: `${q} Sprint ${sprintNum}`,
        startYmd,
        endYmd,
      });
    }
  }
  return markers;
}

function quarterLabel(d: Date): string {
  const m = d.getMonth(); // 0-based local from constructed date
  const q = Math.floor(m / 3) + 1;
  return `Q${q}`;
}

/** Default calendar business window (America/Chicago). Grid expands only for out-of-window sessions. */
export const BUSINESS_START = { h: 8, m: 30 };
export const BUSINESS_END = { h: 17, m: 0 };
