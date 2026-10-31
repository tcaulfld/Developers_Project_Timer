import type { Bucket, Session, Settings, Timer, TimerInput } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getSettings: () => request<Settings>('/settings'),
  updateSettings: (allowMultipleActive: boolean) =>
    request<Settings>('/settings', {
      method: 'PATCH',
      body: JSON.stringify({ allowMultipleActive }),
    }),

  listTimers: (bucket?: Bucket) =>
    request<Timer[]>(bucket ? `/timers?bucket=${bucket}` : '/timers'),

  createTimer: (input: TimerInput) =>
    request<Timer>('/timers', { method: 'POST', body: JSON.stringify(input) }),

  updateTimer: (id: number, input: Partial<TimerInput>) =>
    request<Timer>(`/timers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  deleteTimer: (id: number) =>
    request<void>(`/timers/${id}`, { method: 'DELETE' }),

  startTimer: (id: number) =>
    request<Timer>(`/timers/${id}/start`, { method: 'POST' }),

  pauseTimer: (id: number) =>
    request<Timer>(`/timers/${id}/pause`, { method: 'POST' }),

  listSessions: (timerId: number) =>
    request<Session[]>(`/timers/${timerId}/sessions`),

  createSession: (input: {
    timerId: number;
    startedAt: string;
    endedAt?: string | null;
  }) =>
    request<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateSession: (
    id: number,
    input: { startedAt?: string; endedAt?: string | null },
  ) =>
    request<Session>(`/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  deleteSession: (id: number) =>
    request<void>(`/sessions/${id}`, { method: 'DELETE' }),

  calendarSessions: (start: string, end: string) =>
    request<Session[]>(
      `/calendar/sessions?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    ),
};
