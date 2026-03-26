export type ActivityBarMode = 'activity' | 'output';

export const ACTIVITY_BAR_FOCUS_EVENT = 'subframe:focus-activity-bar';

export interface ActivityBarFocusDetail {
  mode?: ActivityBarMode;
  streamId?: string | null;
}

export function focusActivityBar(detail: ActivityBarFocusDetail = {}): void {
  window.dispatchEvent(new CustomEvent<ActivityBarFocusDetail>(ACTIVITY_BAR_FOCUS_EVENT, { detail }));
}
