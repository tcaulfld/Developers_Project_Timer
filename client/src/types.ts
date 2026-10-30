export type Bucket = 'closed' | 'open' | 'future';
export type TimerType = 'Epic' | 'Feature' | 'User Story' | 'Task' | 'Other';

/** User Story session work labels (persisted on sessions.work_label). */
export const USER_STORY_WORK_LABELS = [
  'TD',
  'Development',
  'UTS',
  'Review',
  'Release',
] as const;
export type UserStoryWorkLabel = (typeof USER_STORY_WORK_LABELS)[number];

export interface Timer {
  id: number;
  label: string;
  projectNumber: string | null;
  description: string | null;
  type: TimerType;
  epicId: number | null;
  bucket: Bucket;
  createdAt: string;
  updatedAt: string;
  activeSessionId: number | null;
  /** Whole minutes only — UI shows HH:MM. */
  totalMinutes: number;
  /** @deprecated Prefer totalMinutes; kept for older API payloads. */
  totalSeconds?: number;
  isRunning: boolean;
}

export interface Session {
  id: number;
  timerId: number;
  startedAt: string;
  endedAt: string | null;
  /** User Story only: TD | Development | UTS | Review | Release */
  workLabel: UserStoryWorkLabel | null;
  createdAt: string;
  updatedAt: string;
  timerLabel?: string;
  projectNumber?: string | null;
  timerType?: TimerType;
}

export interface LabelTotals {
  timerId: number;
  type: TimerType;
  labels: UserStoryWorkLabel[];
  totals: { workLabel: UserStoryWorkLabel; totalMinutes: number }[];
  note?: string;
}

export interface Settings {
  allowMultipleActive: boolean;
}

export interface TimerInput {
  label: string;
  projectNumber?: string | null;
  description?: string | null;
  type: TimerType;
  epicId?: number | null;
  bucket: Bucket;
}
