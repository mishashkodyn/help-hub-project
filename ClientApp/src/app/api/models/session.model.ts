export interface ClientSessionDto {
  id: string;
  psychologistName: string;
  psychologistUserId: string;
  startTime: string;
  endTime: string;
  status: 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled' | 'NoShow';
  price: number;
  clientNotes?: string;
  isAccessible: boolean;
}

export interface SessionInfoDto {
  id: string;
  psychologistName: string;
  psychologistUserId: string;
  clientName: string;
  clientUserId: string;
  startTime: string;
  endTime: string;
  status: string;
  isAccessible: boolean;
}

// ── Display status ────────────────────────────────────────────────────────────
export type DisplayStatus = 'pending' | 'upcoming' | 'live' | 'completed' | 'cancelled';

export interface DisplayStatusInfo {
  key: DisplayStatus;
  label: string;
  icon: string;
  classes: string;
  pulse: boolean;
}

const STATUS_MAP: Record<DisplayStatus, DisplayStatusInfo> = {
  pending:   { key: 'pending',   label: 'Pending',    icon: 'schedule',        classes: 'bg-yellow-100 text-yellow-700',                     pulse: false },
  upcoming:  { key: 'upcoming',  label: 'Upcoming',   icon: 'event_available', classes: 'bg-green-100 text-green-700',                       pulse: false },
  live:      { key: 'live',      label: 'Live',        icon: 'play_circle',     classes: 'bg-emerald-500 text-white shadow-sm shadow-emerald-200', pulse: true  },
  completed: { key: 'completed', label: 'Completed',  icon: 'done_all',        classes: 'bg-blue-100 text-blue-700',                         pulse: false },
  cancelled: { key: 'cancelled', label: 'Cancelled',  icon: 'block',           classes: 'bg-red-100 text-red-700',                           pulse: false },
};

export function resolveDisplayStatus(session: { status: string; startTime: string; endTime: string }): DisplayStatusInfo {
  const { status, startTime, endTime } = session;
  if (status === 'Cancelled' || status === 'NoShow') return STATUS_MAP.cancelled;
  if (status === 'Pending')    return STATUS_MAP.pending;
  if (status === 'Completed')  return STATUS_MAP.completed;
  // Confirmed — determine by time
  const now = Date.now();
  const start = new Date(startTime).getTime();
  const end   = new Date(endTime).getTime();
  if (now > end)                        return STATUS_MAP.completed; // ended, DB update pending
  if (now >= start - 5 * 60_000)        return STATUS_MAP.live;     // within 5-min access window
  return STATUS_MAP.upcoming;
}

export interface SessionMessageDto {
  id: string;
  appointmentId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdDate: string;
}

export interface SessionNoteDto {
  id: string;
  appointmentId: string;
  content: string;
  createdDate: string;
  updatedDate: string;
}

export interface PastSessionDto {
  id: string;
  clientName: string;
  clientUserId: string;
  startTime: string;
  endTime: string;
  status: 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled' | 'NoShow';
  price: number;
  clientNotes?: string;
  hasPsychologistNote: boolean;
}
