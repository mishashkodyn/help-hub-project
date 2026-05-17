import {
  Component,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AppointmentClientService } from '../../../../api/services/appointment-client.service';
import { SessionHubService } from '../../../../api/services/session-hub.service';
import { AuthService } from '../../../../api/services/auth.service';
import { SessionTranscriptStore } from '../../../../api/services/session-transcript-store.service';
import { SessionInfoDto, SessionMessageDto } from '../../../../api/models/session.model';
import { AiService } from '../../../../api/services/ai.service';
import { AiChatMessage } from '../../../../api/models/ai-chat-message';
import { AiChatRequest, AiMessage } from '../../../../api/models/ai-chat-request';

type SessionTab = 'chat' | 'transcriptions' | 'notes' | 'ai';

@Component({
  selector: 'app-session-room',
  standalone: false,
  templateUrl: './session-room.component.html',
  styleUrl: './session-room.component.scss',
})
export class SessionRoomComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('aiMessagesContainer') aiMessagesContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('transcriptsContainer') transcriptsContainer?: ElementRef<HTMLDivElement>;

  sessionInfo = signal<SessionInfoDto | null>(null);
  messages = signal<SessionMessageDto[]>([]);
  isLoading = signal(true);
  isAccessDenied = signal(false);
  activeTab = signal<SessionTab>('chat');
  isVideoOpen = signal(false);

  // Notes
  noteContent = signal('');
  noteSaveState = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  private noteLoaded = false;
  private noteSave$ = new Subject<string>();

  // AI assistant (psychologist-only)
  aiMessages = signal<AiChatMessage[]>([]);
  aiInput = '';
  aiLoading = signal(false);
  private aiProvider = 'Groq';

  messageInput = '';
  appointmentId!: string;
  private subs = new Subscription();

  private appointmentService = inject(AppointmentClientService);
  protected sessionHub = inject(SessionHubService);
  protected transcripts = inject(SessionTranscriptStore);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private aiService = inject(AiService);

  constructor() {
    effect(() => {
      const finals = this.transcripts.finals();
      const interims = this.transcripts.interims();
      // Touch both to make the effect react to either updating.
      void finals.length;
      void Object.keys(interims).length;
      if (this.activeTab() === 'transcriptions') {
        this.scrollTranscriptsToBottom();
      }
    });
  }

  private readonly allTabs: { id: SessionTab; label: string; icon: string }[] = [
    { id: 'chat', label: 'Chat', icon: 'chat' },
    { id: 'transcriptions', label: 'Transcriptions', icon: 'subtitles' },
    { id: 'notes', label: 'Notes', icon: 'edit_note' },
    { id: 'ai', label: 'AI', icon: 'smart_toy' },
  ];

  get tabs(): { id: SessionTab; label: string; icon: string }[] {
    return this.isPsychologist
      ? this.allTabs
      : this.allTabs.filter(
          (t) => t.id !== 'transcriptions' && t.id !== 'notes' && t.id !== 'ai',
        );
  }

  get myUserId(): string {
    return this.authService.currentLoggedUser?.id ?? '';
  }

  get isPsychologist(): boolean {
    return this.authService.isPsychologist;
  }

  ngOnInit(): void {
    this.appointmentId = this.route.snapshot.paramMap.get('id')!;
    this.loadSession();

    // Auto-save notes after 800 ms of inactivity.
    this.subs.add(
      this.noteSave$.pipe(debounceTime(800)).subscribe((content) => this.persistNote(content))
    );

    if (this.isPsychologist) {
      this.authService.getUserAIProveder().subscribe({
        next: (res) => {
          this.aiProvider = res?.data?.preferredAiProvider || 'Groq';
        },
        error: () => {
          this.aiProvider = 'Groq';
        },
      });
    }
  }

  private loadSession(): void {
    this.appointmentService.getSessionInfo(this.appointmentId).subscribe({
      next: (info) => {
        if (!info.isAccessible) {
          this.isAccessDenied.set(true);
          this.isLoading.set(false);
          return;
        }

        this.sessionInfo.set(info);
        this.isLoading.set(false);
        this.initHub();
      },
      error: () => {
        this.isAccessDenied.set(true);
        this.isLoading.set(false);
      },
    });
  }

  private initHub(): void {
    this.subs.add(
      this.sessionHub.historyReceived.subscribe((msgs) => {
        this.messages.set(msgs);
        this.scrollToBottom();
      })
    );

    this.subs.add(
      this.sessionHub.messageReceived.subscribe((msg) => {
        this.messages.update((m) => [...m, msg]);
        this.scrollToBottom();
      })
    );

    this.subs.add(
      this.sessionHub.transcriptReceived.subscribe(({ senderId, text, isFinal, timestamp }) => {
        this.transcripts.push(senderId, text, isFinal, timestamp);
      })
    );

    this.sessionHub.startConnection(this.appointmentId);
  }

  resolveSpeakerName(speaker: string): string {
    const info = this.sessionInfo();
    if (!info) return '';
    if (speaker === 'local') {
      return this.myUserId === info.psychologistUserId ? info.psychologistName : info.clientName;
    }
    if (speaker === info.psychologistUserId) return info.psychologistName;
    if (speaker === info.clientUserId) return info.clientName;
    return '';
  }

  isLocalSpeaker(speaker: string): boolean {
    return speaker === 'local';
  }

  isPsychologistSpeaker(speaker: string): boolean {
    const info = this.sessionInfo();
    if (!info) return false;
    if (speaker === 'local') return this.myUserId === info.psychologistUserId;
    return speaker === info.psychologistUserId;
  }

  roleLabel(speaker: string): string {
    return this.isPsychologistSpeaker(speaker) ? 'Psychologist' : 'Client';
  }

  private scrollTranscriptsToBottom(): void {
    setTimeout(() => {
      const el = this.transcriptsContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  selectTab(tab: SessionTab): void {
    this.activeTab.set(tab);
    if (tab === 'chat') this.scrollToBottom();
    if (tab === 'notes' && this.isPsychologist && !this.noteLoaded) {
      this.loadNote();
    }
    if (tab === 'ai') this.scrollAiToBottom();
  }

  sendAiMessage(): void {
    const content = this.aiInput?.trim();
    if (!content || this.aiLoading()) return;

    const userMsg: AiChatMessage = {
      text: content,
      isUser: true,
      timestamp: new Date(),
    };
    this.aiMessages.update((m) => [...m, userMsg]);
    this.aiInput = '';
    this.aiLoading.set(true);
    this.scrollAiToBottom();

    const history: AiMessage[] = this.aiMessages()
      .slice(-10)
      .map((m) => ({
        role: m.isUser ? 'user' : 'assistant',
        content: m.text,
      }));

    const payload: AiChatRequest = {
      userName:
        (this.authService.currentLoggedUser?.name ?? '') +
        ' ' +
        (this.authService.currentLoggedUser?.surname ?? ''),
      provider: this.aiProvider,
      messages: history,
      context: 'SessionAssistant',
    };

    this.aiService.chatAsync(payload).subscribe({
      next: (response) => {
        this.aiMessages.update((m) => [
          ...m,
          { text: response.data, isUser: false, timestamp: new Date() },
        ]);
        this.aiLoading.set(false);
        this.scrollAiToBottom();
      },
      error: () => {
        this.aiMessages.update((m) => [
          ...m,
          { text: 'AI did not answer', isUser: false, timestamp: new Date() },
        ]);
        this.aiLoading.set(false);
        this.scrollAiToBottom();
      },
    });
  }

  onAiKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendAiMessage();
    }
  }

  private scrollAiToBottom(): void {
    setTimeout(() => {
      const el = this.aiMessagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  private loadNote(): void {
    this.appointmentService.getSessionNote(this.appointmentId).subscribe({
      next: (note) => {
        this.noteContent.set(note?.content ?? '');
        this.noteLoaded = true;
      },
      error: (err) => console.error('[Notes] Load failed', err),
    });
  }

  onNoteInput(value: string): void {
    this.noteContent.set(value);
    this.noteSaveState.set('saving');
    this.noteSave$.next(value);
  }

  private persistNote(content: string): void {
    this.appointmentService.saveSessionNote(this.appointmentId, content).subscribe({
      next: () => this.noteSaveState.set('saved'),
      error: (err) => {
        console.error('[Notes] Save failed', err);
        this.noteSaveState.set('error');
      },
    });
  }

  toggleVideo(): void {
    this.isVideoOpen.update((v) => !v);
  }

  onVideoClosed(): void {
    this.isVideoOpen.set(false);
  }

  async sendMessage(): Promise<void> {
    const content = this.messageInput.trim();
    if (!content) return;
    this.messageInput = '';
    await this.sessionHub.sendMessage(this.appointmentId, content);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  isMine(msg: SessionMessageDto): boolean {
    return msg.senderId === this.myUserId;
  }

  goBack(): void {
    this.router.navigate(['/my-sessions']);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.transcripts.clear();
    this.sessionHub.stopConnection();
  }
}
