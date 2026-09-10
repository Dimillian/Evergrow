export type CloudStatus = 'Synced' | 'Saving…' | 'Offline' | 'Conflict' | 'Sign in again' | 'Cloud unavailable' | 'Save needs attention' | 'Storage unavailable' | 'Reload required';
export class CloudError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export class CloudStorageError extends Error {
  reload: boolean;
  constructor(message: string, reload = false) { super(message); this.reload = reload; }
}
export class CloudSaveError extends Error {}
export function cloudFailureStatus(error: unknown): CloudStatus {
  if (error instanceof CloudStorageError) return error.reload ? 'Reload required' : 'Storage unavailable';
  if (error instanceof CloudSaveError) return 'Save needs attention';
  if (error instanceof CloudError) return error.status === 401 ? 'Sign in again' : error.status === 409 ? 'Conflict'
    : error.status >= 500 || error.status === 429 ? 'Cloud unavailable' : 'Save needs attention';
  return 'Offline';
}
