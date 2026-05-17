import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { AppointmentClientService } from '../../../../api/services/appointment-client.service';
import { NotificationService } from '../../../../api/services/notification.service';
import { ClientSessionDto, DisplayStatusInfo, resolveDisplayStatus } from '../../../../api/models/session.model';

type SessionFilter = 'All' | 'Upcoming' | 'Completed' | 'Cancelled';

@Component({
  selector: 'app-psychologist-sessions',
  standalone: false,
  templateUrl: './psychologist-sessions.component.html',
  styleUrl: './psychologist-sessions.component.scss',
})
export class PsychologistSessionsComponent implements OnInit, OnDestroy {
  allSessions: ClientSessionDto[] = [];
  sessions: ClientSessionDto[] = [];
  isLoading = true;
  currentFilter: SessionFilter = 'Upcoming';
  private sub = new Subscription();

  filterOptions: { value: SessionFilter; label: string; icon: string }[] = [
    { value: 'All',       label: 'All',       icon: 'apps'            },
    { value: 'Upcoming',  label: 'Upcoming',  icon: 'event_available' },
    { value: 'Completed', label: 'Completed', icon: 'done_all'        },
    { value: 'Cancelled', label: 'Cancelled', icon: 'block'           },
  ];

  constructor(
    private appointmentService: AppointmentClientService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.load();

    this.sub.add(
      this.notificationService.sessionStartingSoon.subscribe((id) => {
        const s = this.allSessions.find(x => x.id === id);
        if (s) { s.isAccessible = true; this.applyFilter(); }
      })
    );

    this.sub.add(
      this.notificationService.sessionCompleted.subscribe((id) => {
        const s = this.allSessions.find(x => x.id === id);
        if (s) { (s as any).status = 'Completed'; s.isAccessible = false; this.applyFilter(); }
      })
    );
  }

  load(): void {
    this.isLoading = true;
    this.appointmentService.getPsychologistSessions()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (data) => { this.allSessions = data; this.applyFilter(); },
        error: (err)  => console.error('Failed to load sessions', err),
      });
  }

  setFilter(f: SessionFilter): void {
    this.currentFilter = f;
    this.applyFilter();
  }

  applyFilter(): void {
    if (this.currentFilter === 'All') {
      this.sessions = [...this.allSessions];
    } else if (this.currentFilter === 'Upcoming') {
      this.sessions = this.allSessions
        .filter(s => { const d = resolveDisplayStatus(s); return d.key === 'upcoming' || d.key === 'live' || d.key === 'pending'; })
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    } else if (this.currentFilter === 'Completed') {
      this.sessions = this.allSessions.filter(s => resolveDisplayStatus(s).key === 'completed');
    } else {
      this.sessions = this.allSessions.filter(s => resolveDisplayStatus(s).key === 'cancelled');
    }
  }

  getFilterCount(f: SessionFilter): number {
    if (f === 'All') return this.allSessions.length;
    if (f === 'Upcoming')  return this.allSessions.filter(s => { const d = resolveDisplayStatus(s); return d.key === 'upcoming' || d.key === 'live' || d.key === 'pending'; }).length;
    if (f === 'Completed') return this.allSessions.filter(s => resolveDisplayStatus(s).key === 'completed').length;
    return this.allSessions.filter(s => resolveDisplayStatus(s).key === 'cancelled').length;
  }

  getStatus(session: ClientSessionDto): DisplayStatusInfo {
    return resolveDisplayStatus(session);
  }

  joinSession(session: ClientSessionDto): void {
    this.router.navigate(['/session', session.id]);
  }

  goBack(): void {
    this.router.navigate(['/psychologist']);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
