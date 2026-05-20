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
import {
  TranscriptAnalysisAction,
  TranscriptAnalysisRequest,
} from '../../../../api/models/transcript-analysis-request';

type SessionTab = 'chat' | 'transcriptions' | 'notes' | 'ai';

type TimeRangeId = '5m' | '15m' | '30m' | 'all';

interface TimeRangeOption {
  id: TimeRangeId;
  label: string;
  minutes: number | null;
}

interface AnalysisActionOption {
  id: TranscriptAnalysisAction;
  label: string;
  icon: string;
  description: string;
}

interface SelectionTooltipState {
  visible: boolean;
  x: number;
  y: number;
  text: string;
}

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

  // Transcript analysis (psychologist-only)
  isAnalysisMenuOpen = signal(false);
  isAnalyzing = signal(false);
  selectedRangeId = signal<TimeRangeId>('all');

  readonly timeRanges: TimeRangeOption[] = [
    { id: '5m', label: 'Last 5 min', minutes: 5 },
    { id: '15m', label: 'Last 15 min', minutes: 15 },
    { id: '30m', label: 'Last 30 min', minutes: 30 },
    { id: 'all', label: 'Whole session', minutes: null },
  ];

  readonly rangeAnalysisActions: AnalysisActionOption[] = [
    { id: 'summarize', label: 'Summary', icon: 'summarize', description: 'Clinical recap of the range' },
    { id: 'emotions', label: 'Emotional dynamics', icon: 'mood', description: 'Track emotion shifts' },
    { id: 'patterns', label: 'Patterns & distortions', icon: 'psychology', description: 'Find cognitive patterns' },
    { id: 'questions', label: 'Follow-up questions', icon: 'help_outline', description: 'Suggest next questions' },
    { id: 'risks', label: 'Risk assessment', icon: 'report', description: 'Flag risk factors' },
  ];

  readonly selectionActions: AnalysisActionOption[] = [
    { id: 'explain', label: 'Explain', icon: 'lightbulb', description: 'What client may have meant' },
    { id: 'rephrase', label: 'Reflect', icon: 'autorenew', description: 'Reflective reformulations' },
    { id: 'intervention', label: 'Intervention', icon: 'medical_services', description: 'Suggest a technique' },
    { id: 'questions', label: 'Ask next', icon: 'help_outline', description: 'Follow-up questions' },
  ];

  selectionTooltip = signal<SelectionTooltipState>({ visible: false, x: 0, y: 0, text: '' });

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

  // ---------- Transcript analysis ----------

  toggleAnalysisMenu(): void {
    this.isAnalysisMenuOpen.update((v) => !v);
  }

  closeAnalysisMenu(): void {
    this.isAnalysisMenuOpen.set(false);
  }

  selectRange(rangeId: TimeRangeId): void {
    this.selectedRangeId.set(rangeId);
  }

  get selectedRange(): TimeRangeOption {
    return this.timeRanges.find((r) => r.id === this.selectedRangeId())!;
  }

  runRangeAnalysis(action: TranscriptAnalysisAction): void {
    this.closeAnalysisMenu();
    const range = this.selectedRange;
    const transcript = this.buildTranscriptForRange(range);

    if (!transcript) {
      this.pushAiSystemMessage(
        `_No transcript available for **${range.label}** yet._`
      );
      this.activeTab.set('ai');
      this.scrollAiToBottom();
      return;
    }

    const actionMeta = this.rangeAnalysisActions.find((a) => a.id === action);
    const headerLabel = actionMeta?.label ?? action;

    this.dispatchAnalysis({
      transcript,
      action,
      timeRangeLabel: range.label,
      userName: this.fullUserName(),
    }, `**${headerLabel}** — ${range.label}`);
  }

  runSelectionAnalysis(action: TranscriptAnalysisAction): void {
    const state = this.selectionTooltip();
    const text = state.text;
    this.hideSelectionTooltip();
    if (!text) return;

    const actionMeta = this.selectionActions.find((a) => a.id === action);
    const headerLabel = actionMeta?.label ?? action;
    const preview = text.length > 120 ? text.slice(0, 120) + '…' : text;

    this.dispatchAnalysis({
      transcript: this.buildTranscriptForRange(this.timeRanges.find((r) => r.id === 'all')!) || text,
      selectedText: text,
      action,
      userName: this.fullUserName(),
    }, `**${headerLabel}** on selection\n\n> ${preview}`);
  }

  private dispatchAnalysis(request: TranscriptAnalysisRequest, header: string): void {
    if (this.isAnalyzing()) return;
    this.isAnalyzing.set(true);

    this.pushAiUserMessage(header);
    this.activeTab.set('ai');
    this.scrollAiToBottom();

    this.aiService.analyzeTranscriptAsync(request).subscribe({
      next: (response) => {
        this.aiMessages.update((m) => [
          ...m,
          { text: response.data, isUser: false, timestamp: new Date() },
        ]);
        this.isAnalyzing.set(false);
        this.scrollAiToBottom();
      },
      error: () => {
        this.aiMessages.update((m) => [
          ...m,
          { text: 'AI analysis failed. Try again in a moment.', isUser: false, timestamp: new Date() },
        ]);
        this.isAnalyzing.set(false);
        this.scrollAiToBottom();
      },
    });
  }

  private buildTranscriptForRange(range: TimeRangeOption): string {
    const finals = this.transcripts.finals();
    if (finals.length === 0) return '';

    const cutoff = range.minutes != null ? Date.now() - range.minutes * 60_000 : null;

    const filtered = cutoff == null
      ? finals
      : finals.filter((f) => {
          const t = Date.parse(f.timestamp);
          return Number.isFinite(t) ? t >= cutoff : true;
        });

    if (filtered.length === 0) return '';

    return filtered
      .map((f) => {
        const time = new Date(f.timestamp);
        const hh = String(time.getHours()).padStart(2, '0');
        const mm = String(time.getMinutes()).padStart(2, '0');
        const ss = String(time.getSeconds()).padStart(2, '0');
        return `[${hh}:${mm}:${ss}] ${this.roleLabel(f.speaker)}: ${f.text}`;
      })
      .join('\n');
  }

  private pushAiUserMessage(text: string): void {
    this.aiMessages.update((m) => [
      ...m,
      { text, isUser: true, timestamp: new Date() },
    ]);
  }

  private pushAiSystemMessage(text: string): void {
    this.aiMessages.update((m) => [
      ...m,
      { text, isUser: false, timestamp: new Date() },
    ]);
  }

  private fullUserName(): string {
    const u = this.authService.currentLoggedUser;
    return ((u?.name ?? '') + ' ' + (u?.surname ?? '')).trim();
  }

  // ---------- Selection tooltip ----------

  onTranscriptMouseUp(event: MouseEvent): void {
    if (!this.isPsychologist) return;
    const selection = window.getSelection?.();
    const text = selection?.toString().trim() ?? '';
    if (!text) {
      this.hideSelectionTooltip();
      return;
    }

    const container = this.transcriptsContainer?.nativeElement;
    if (container && selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        this.hideSelectionTooltip();
        return;
      }
    }

    const padding = 8;
    const tooltipWidth = 280;
    const x = Math.max(padding, Math.min(window.innerWidth - tooltipWidth - padding, event.clientX));
    const y = Math.max(padding, event.clientY - 12);

    this.selectionTooltip.set({ visible: true, x, y, text });
  }

  hideSelectionTooltip(): void {
    if (this.selectionTooltip().visible) {
      this.selectionTooltip.set({ visible: false, x: 0, y: 0, text: '' });
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.transcripts.clear();
    this.sessionHub.stopConnection();
  }
}
