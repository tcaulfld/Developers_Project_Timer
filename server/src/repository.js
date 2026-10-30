/**
 * Data-access layer. Keep SQL here so storage can be swapped later.
 */
export function createRepository(db) {
  const getSetting = db.prepare(`SELECT value FROM settings WHERE key = ?`);
  const setSetting = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );

  const listTimers = db.prepare(`
    SELECT t.*,
      (SELECT s.id FROM sessions s WHERE s.timer_id = t.id AND s.ended_at IS NULL LIMIT 1) AS active_session_id,
      (SELECT COALESCE(SUM(
          CAST((julianday(COALESCE(s.ended_at, datetime('now'))) - julianday(s.started_at)) * 86400 AS INTEGER)
        ), 0)
       FROM sessions s WHERE s.timer_id = t.id) AS total_seconds
    FROM timers t
    ORDER BY t.updated_at DESC, t.id DESC
  `);

  const getTimer = db.prepare(`
    SELECT t.*,
      (SELECT s.id FROM sessions s WHERE s.timer_id = t.id AND s.ended_at IS NULL LIMIT 1) AS active_session_id,
      (SELECT COALESCE(SUM(
          CAST((julianday(COALESCE(s.ended_at, datetime('now'))) - julianday(s.started_at)) * 86400 AS INTEGER)
        ), 0)
       FROM sessions s WHERE s.timer_id = t.id) AS total_seconds
    FROM timers t
    WHERE t.id = ?
  `);

  const insertTimer = db.prepare(`
    INSERT INTO timers (label, project_number, description, type, epic_id, bucket, created_at, updated_at)
    VALUES (@label, @project_number, @description, @type, @epic_id, @bucket, datetime('now'), datetime('now'))
  `);

  const updateTimer = db.prepare(`
    UPDATE timers SET
      label = @label,
      project_number = @project_number,
      description = @description,
      type = @type,
      epic_id = @epic_id,
      bucket = @bucket,
      updated_at = datetime('now')
    WHERE id = @id
  `);

  const deleteTimer = db.prepare(`DELETE FROM timers WHERE id = ?`);

  const listSessions = db.prepare(`
    SELECT * FROM sessions WHERE timer_id = ? ORDER BY started_at DESC
  `);

  const listSessionsInRange = db.prepare(`
    SELECT s.*, t.label AS timer_label, t.project_number, t.type AS timer_type
    FROM sessions s
    JOIN timers t ON t.id = s.timer_id
    WHERE s.started_at < @end
      AND COALESCE(s.ended_at, datetime('now')) > @start
    ORDER BY s.started_at ASC
  `);

  const getSession = db.prepare(`SELECT * FROM sessions WHERE id = ?`);
  const getActiveSession = db.prepare(
    `SELECT * FROM sessions WHERE timer_id = ? AND ended_at IS NULL LIMIT 1`,
  );
  const getAnyActiveSessions = db.prepare(
    `SELECT * FROM sessions WHERE ended_at IS NULL`,
  );

  const insertSession = db.prepare(`
    INSERT INTO sessions (timer_id, started_at, ended_at, created_at, updated_at)
    VALUES (@timer_id, @started_at, @ended_at, datetime('now'), datetime('now'))
  `);

  const updateSession = db.prepare(`
    UPDATE sessions SET
      started_at = @started_at,
      ended_at = @ended_at,
      updated_at = datetime('now')
    WHERE id = @id
  `);

  const deleteSession = db.prepare(`DELETE FROM sessions WHERE id = ?`);
  const endSession = db.prepare(`
    UPDATE sessions SET ended_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `);
  const touchTimer = db.prepare(
    `UPDATE timers SET updated_at = datetime('now') WHERE id = ?`,
  );

  function allowMultipleActive() {
    const row = getSetting.get('allow_multiple_active');
    return row?.value === 'true';
  }

  function mapTimer(row) {
    if (!row) return null;
    return {
      id: row.id,
      label: row.label,
      projectNumber: row.project_number,
      description: row.description,
      type: row.type,
      epicId: row.epic_id,
      bucket: row.bucket,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      activeSessionId: row.active_session_id ?? null,
      totalSeconds: row.total_seconds ?? 0,
      isRunning: Boolean(row.active_session_id),
    };
  }

  function mapSession(row) {
    if (!row) return null;
    return {
      id: row.id,
      timerId: row.timer_id,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      timerLabel: row.timer_label,
      projectNumber: row.project_number,
      timerType: row.timer_type,
    };
  }

  return {
    getSettings() {
      return {
        allowMultipleActive: allowMultipleActive(),
      };
    },

    updateSettings({ allowMultipleActive: multi }) {
      if (typeof multi === 'boolean') {
        setSetting.run('allow_multiple_active', multi ? 'true' : 'false');
      }
      return this.getSettings();
    },

    listTimers(bucket) {
      const all = listTimers.all().map(mapTimer);
      if (!bucket || bucket === 'all') return all;
      return all.filter((t) => t.bucket === bucket);
    },

    getTimer(id) {
      return mapTimer(getTimer.get(id));
    },

    createTimer(input) {
      const info = insertTimer.run({
        label: input.label,
        project_number: input.projectNumber ?? null,
        description: input.description ?? null,
        type: input.type,
        epic_id: input.epicId ?? null,
        bucket: input.bucket ?? 'open',
      });
      return this.getTimer(Number(info.lastInsertRowid));
    },

    updateTimer(id, input) {
      const existing = this.getTimer(id);
      if (!existing) return null;
      updateTimer.run({
        id,
        label: input.label ?? existing.label,
        project_number:
          input.projectNumber !== undefined
            ? input.projectNumber
            : existing.projectNumber,
        description:
          input.description !== undefined
            ? input.description
            : existing.description,
        type: input.type ?? existing.type,
        epic_id: input.epicId !== undefined ? input.epicId : existing.epicId,
        bucket: input.bucket ?? existing.bucket,
      });
      return this.getTimer(id);
    },

    deleteTimer(id) {
      const info = deleteTimer.run(id);
      return info.changes > 0;
    },

    listSessions(timerId) {
      return listSessions.all(timerId).map(mapSession);
    },

    listSessionsInRange(start, end) {
      return listSessionsInRange.all({ start, end }).map(mapSession);
    },

    createSession(input) {
      const info = insertSession.run({
        timer_id: input.timerId,
        started_at: input.startedAt,
        ended_at: input.endedAt ?? null,
      });
      touchTimer.run(input.timerId);
      return mapSession(getSession.get(Number(info.lastInsertRowid)));
    },

    updateSession(id, input) {
      const existing = getSession.get(id);
      if (!existing) return null;
      updateSession.run({
        id,
        started_at: input.startedAt ?? existing.started_at,
        ended_at:
          input.endedAt !== undefined ? input.endedAt : existing.ended_at,
      });
      touchTimer.run(existing.timer_id);
      return mapSession(getSession.get(id));
    },

    deleteSession(id) {
      const existing = getSession.get(id);
      if (!existing) return false;
      deleteSession.run(id);
      touchTimer.run(existing.timer_id);
      return true;
    },

    startTimer(timerId) {
      const timer = this.getTimer(timerId);
      if (!timer) return { error: 'not_found' };
      if (timer.isRunning) return { timer, alreadyRunning: true };

      if (!allowMultipleActive()) {
        const actives = getAnyActiveSessions.all();
        for (const s of actives) {
          endSession.run(s.id);
          touchTimer.run(s.timer_id);
        }
      }

      insertSession.run({
        timer_id: timerId,
        started_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        ended_at: null,
      });
      touchTimer.run(timerId);
      return { timer: this.getTimer(timerId) };
    },

    pauseTimer(timerId) {
      const timer = this.getTimer(timerId);
      if (!timer) return { error: 'not_found' };
      const active = getActiveSession.get(timerId);
      if (!active) return { timer, alreadyPaused: true };
      endSession.run(active.id);
      touchTimer.run(timerId);
      return { timer: this.getTimer(timerId) };
    },
  };
}
