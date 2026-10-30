import { Router } from 'express';

const TIMER_TYPES = new Set(['Epic', 'Feature', 'User Story', 'Task']);
const BUCKETS = new Set(['closed', 'open', 'future']);

export function createRouter(repo) {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  router.get('/settings', (_req, res) => {
    res.json(repo.getSettings());
  });

  router.patch('/settings', (req, res) => {
    const { allowMultipleActive } = req.body ?? {};
    res.json(repo.updateSettings({ allowMultipleActive }));
  });

  router.get('/timers', (req, res) => {
    const bucket = req.query.bucket;
    res.json(repo.listTimers(bucket));
  });

  router.get('/timers/:id', (req, res) => {
    const timer = repo.getTimer(Number(req.params.id));
    if (!timer) return res.status(404).json({ error: 'Timer not found' });
    res.json(timer);
  });

  router.post('/timers', (req, res) => {
    const body = req.body ?? {};
    if (!body.label?.trim()) {
      return res.status(400).json({ error: 'label is required' });
    }
    if (!TIMER_TYPES.has(body.type)) {
      return res.status(400).json({ error: 'invalid type' });
    }
    if (body.bucket && !BUCKETS.has(body.bucket)) {
      return res.status(400).json({ error: 'invalid bucket' });
    }
    if (body.type !== 'Epic' && body.projectNumber && body.epicId == null) {
      // project number ties Feature/US/Task to an Epic; epicId preferred when known
    }
    const timer = repo.createTimer({
      label: body.label.trim(),
      projectNumber: body.projectNumber ?? null,
      description: body.description ?? null,
      type: body.type,
      epicId: body.epicId ?? null,
      bucket: body.bucket ?? 'open',
    });
    res.status(201).json(timer);
  });

  router.patch('/timers/:id', (req, res) => {
    const id = Number(req.params.id);
    const body = req.body ?? {};
    if (body.type && !TIMER_TYPES.has(body.type)) {
      return res.status(400).json({ error: 'invalid type' });
    }
    if (body.bucket && !BUCKETS.has(body.bucket)) {
      return res.status(400).json({ error: 'invalid bucket' });
    }
    const timer = repo.updateTimer(id, body);
    if (!timer) return res.status(404).json({ error: 'Timer not found' });
    res.json(timer);
  });

  router.delete('/timers/:id', (req, res) => {
    const ok = repo.deleteTimer(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Timer not found' });
    res.status(204).end();
  });

  router.post('/timers/:id/start', (req, res) => {
    const result = repo.startTimer(Number(req.params.id));
    if (result.error === 'not_found') {
      return res.status(404).json({ error: 'Timer not found' });
    }
    res.json(result.timer);
  });

  router.post('/timers/:id/pause', (req, res) => {
    const result = repo.pauseTimer(Number(req.params.id));
    if (result.error === 'not_found') {
      return res.status(404).json({ error: 'Timer not found' });
    }
    res.json(result.timer);
  });

  router.get('/timers/:id/sessions', (req, res) => {
    const timer = repo.getTimer(Number(req.params.id));
    if (!timer) return res.status(404).json({ error: 'Timer not found' });
    res.json(repo.listSessions(timer.id));
  });

  router.post('/sessions', (req, res) => {
    const body = req.body ?? {};
    if (!body.timerId || !body.startedAt) {
      return res.status(400).json({ error: 'timerId and startedAt required' });
    }
    const timer = repo.getTimer(Number(body.timerId));
    if (!timer) return res.status(404).json({ error: 'Timer not found' });
    const session = repo.createSession({
      timerId: Number(body.timerId),
      startedAt: normalizeSqlDate(body.startedAt),
      endedAt: body.endedAt ? normalizeSqlDate(body.endedAt) : null,
    });
    res.status(201).json(session);
  });

  router.patch('/sessions/:id', (req, res) => {
    const body = req.body ?? {};
    const session = repo.updateSession(Number(req.params.id), {
      startedAt: body.startedAt ? normalizeSqlDate(body.startedAt) : undefined,
      endedAt:
        body.endedAt === null
          ? null
          : body.endedAt
            ? normalizeSqlDate(body.endedAt)
            : undefined,
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  });

  router.delete('/sessions/:id', (req, res) => {
    const ok = repo.deleteSession(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Session not found' });
    res.status(204).end();
  });

  router.get('/calendar/sessions', (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ error: 'start and end query params required' });
    }
    res.json(
      repo.listSessionsInRange(normalizeSqlDate(start), normalizeSqlDate(end)),
    );
  });

  return router;
}

function normalizeSqlDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().replace('T', ' ').slice(0, 19);
}
