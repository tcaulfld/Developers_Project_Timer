import type { Settings } from '../types';

interface Props {
  settings: Settings;
  onClose: () => void;
  onToggleMulti: (value: boolean) => Promise<void>;
}

export function SettingsModal({ settings, onClose, onToggleMulti }: Props) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Settings</h2>
            <p>Single-user v1 — auth hooks reserved for later.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="toggle-row">
          <div>
            <strong>Allow multiple active timers</strong>
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted)' }}>
              Off by default: starting one timer pauses any other. Prepared for
              multi-active when enabled.
            </p>
          </div>
          <button
            type="button"
            className={`toggle${settings.allowMultipleActive ? ' on' : ''}`}
            aria-pressed={settings.allowMultipleActive}
            onClick={() => onToggleMulti(!settings.allowMultipleActive)}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="modal-actions">
          <button type="button" className="primary-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
