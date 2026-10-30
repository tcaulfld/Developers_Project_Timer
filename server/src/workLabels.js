/** User Story session work labels — keep in sync with sessions.work_label CHECK. */
export const USER_STORY_WORK_LABELS = [
  'TD',
  'Development',
  'UTS',
  'Review',
  'Release',
];

export function normalizeWorkLabel(value, { allowNull = true } = {}) {
  if (value == null || value === '') {
    return allowNull ? null : undefined;
  }
  if (!USER_STORY_WORK_LABELS.includes(value)) {
    return undefined; // invalid
  }
  return value;
}
