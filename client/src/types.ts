export type Bucket = 'closed' | 'open' | 'future';
export type TimerType = 'Epic' | 'Feature' | 'User Story' | 'Task';

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
  totalSeconds: number;
  isRunning: boolean;
}

export interface Session {
  id: number;
  timerId: number;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  timerLabel?: string;
  projectNumber?: string | null;
  timerType?: TimerType;
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
