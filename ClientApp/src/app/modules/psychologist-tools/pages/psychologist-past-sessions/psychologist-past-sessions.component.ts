import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AppointmentClientService } from '../../../../api/services/appointment-client.service';
import { PastSessionDto, SessionNoteDto } from '../../../../api/models/session.model';

@Component({
  selector: 'app-psychologist-past-sessions',
  standalone: false,
  templateUrl: './psychologist-past-sessions.component.html',
  styleUrl: './psychologist-past-sessions.component.scss',
})
export class PsychologistPastSessionsComponent implements OnInit {
  sessions = signal<PastSessionDto[]>([]);
  isLoading = signal(true);
  selected = signal<PastSessionDto | null>(null);

  noteContent = signal('');
  noteLoading = signal(false);
  noteSaveState = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  private noteSave$ = new Subject<string>();
  search = signal('');

  constructor(
    private appointmentService: AppointmentClientService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.load();

    this.noteSave$.pipe(debounceTime(800)).subscribe((content) => {
      const session = this.selected();
      if (!session) return;
      this.appointmentService.saveSessionNote(session.id, content).subscribe({
        next: () => {
          this.noteSaveState.set('saved');
          this.refreshHasNoteFlag(session.id, !!content.trim());
        },
        error: () => this.noteSaveState.set('error'),
      });
    });
  }

  load(): void {
    this.isLoading.set(true);
    this.appointmentService.getPsychologistPastSessions()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => this.sessions.set(data),
        error: (err) => console.error('Failed to load past sessions', err),
      });
  }

  get filtered(): PastSessionDto[] {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.sessions();
    return this.sessions().filter(s => s.clientName.toLowerCase().includes(q));
  }

  selectSession(session: PastSessionDto): void {
    this.selected.set(session);
    this.noteContent.set('');
    this.noteSaveState.set('idle');
    this.noteLoading.set(true);

    this.appointmentService.getSessionNote(session.id)
      .pipe(finalize(() => this.noteLoading.set(false)))
      .subscribe({
        next: (note: SessionNoteDto | null) => this.noteContent.set(note?.content ?? ''),
        error: () => this.noteContent.set(''),
      });
  }

  onNoteInput(value: string): void {
    this.noteContent.set(value);
    this.noteSaveState.set('saving');
    this.noteSave$.next(value);
  }

  backToList(): void {
    this.selected.set(null);
  }

  goBack(): void {
    this.router.navigate(['/psychologist']);
  }

  private refreshHasNoteFlag(sessionId: string, has: boolean): void {
    this.sessions.update((list) =>
      list.map(s => s.id === sessionId ? { ...s, hasPsychologistNote: has } : s)
    );
  }
}
