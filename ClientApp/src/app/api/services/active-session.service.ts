import { Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AppointmentClientService } from './appointment-client.service';
import { NotificationService } from './notification.service';
import { AuthService } from './auth.service';
import { ClientSessionDto } from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class ActiveSessionService {
  activeSession = signal<ClientSessionDto | null>(null);

  private sub: Subscription | null = null;
  private rescanTimer: ReturnType<typeof setInterval> | null = null;
  private sessions: ClientSessionDto[] = [];

  // Accessibility window: opens 5 min before StartTime, closes at EndTime.
  private readonly OPEN_BEFORE_MS = 5 * 60_000;
  private readonly RESCAN_INTERVAL_MS = 30_000;

  constructor(
    private appointmentService: AppointmentClientService,
    private notificationService: NotificationService,
    private authService: AuthService
  ) {}

  start(): void {
    if (this.sub) return;

    this.refreshSessions();

    this.sub = new Subscription();

    this.sub.add(
      this.notificationService.sessionStartingSoon.subscribe(() => {
        this.refreshSessions();
      })
    );

    this.sub.add(
      this.notificationService.sessionCompleted.subscribe((appointmentId) => {
        if (this.activeSession()?.id === appointmentId) {
          this.activeSession.set(null);
        }
        this.sessions = this.sessions.map(s =>
          s.id === appointmentId ? { ...s, status: 'Completed' as const } : s
        );
        this.recomputeActive();
      })
    );

    this.rescanTimer = setInterval(() => this.recomputeActive(), this.RESCAN_INTERVAL_MS);
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = null;
    if (this.rescanTimer !== null) {
      clearInterval(this.rescanTimer);
      this.rescanTimer = null;
    }
    this.sessions = [];
    this.activeSession.set(null);
  }

  /** Force a refresh — used after the user navigates out of /session/:id, after login, etc. */
  refreshSessions(): void {
    if (!this.authService.isLoggedIn()) return;

    this.fetchSessions().subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        this.recomputeActive();
      },
      error: () => {},
    });
  }

  private fetchSessions() {
    return this.authService.isPsychologist
      ? this.appointmentService.getPsychologistSessions()
      : this.appointmentService.getMySessions();
  }

  /** Recompute active session.
   *  Trusts server's isAccessible flag first (handles TZ edge-cases),
   *  then falls back to client-side time check for real-time precision. */
  private recomputeActive(): void {
    const now = Date.now();

    const active = this.sessions.find((s) => {
      if (s.status !== 'Confirmed') return false;
      // Server already computed the window correctly
      if (s.isAccessible) return true;
      // Client-side real-time check (fires between server refreshes)
      const start = new Date(s.startTime).getTime();
      const end   = new Date(s.endTime).getTime();
      return now >= start - this.OPEN_BEFORE_MS && now <= end;
    }) ?? null;

    const current = this.activeSession();
    if (active?.id !== current?.id) {
      this.activeSession.set(active);
    }
  }
}
