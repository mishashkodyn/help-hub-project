import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  effect,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
} from '@angular/core';
import { ChatService } from '../../../../api/services/chat.service';
import { AuthService } from '../../../../api/services/auth.service';
import { Message } from '../../../../api/models/message';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogModalComponent } from '../../../shared/confirm-dialog-modal/confirm-dialog-modal.component';

@Component({
  selector: 'app-chat-box',
  standalone: false,
  templateUrl: './chat-box.component.html',
  styleUrl: './chat-box.component.scss',
})
export class ChatBoxComponent implements AfterViewInit {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  @Output() viewMedia = new EventEmitter<{ url: string; type: 'image' | 'video' }>();

  private audioElements = new Map<string, HTMLAudioElement>();
  audioProgress = new Map<string, number>();
  audioDuration = new Map<string, string>();
  audioPlaying = new Map<string, boolean>();
  private waveformCache = new Map<string, number[]>();

  constructor(
    protected chatService: ChatService,
    protected authService: AuthService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {
    effect(() => {
      const messages = this.chatService.chatMessages();
      if (messages && messages.length > 0) {
        setTimeout(() => this.scrollToBottom(), 50);
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.scrollToBottom(), 100);
  }

  ngOnInit(): void {}

  openMedia(url: string, type: 'image' | 'video') {
    this.viewMedia.emit({ url, type });
  }

  addReplyMessage(message: Message) {
    if (message) {
      this.chatService.replyMessage.set(message);
    }
  }

  confirmDeleteMessage(message: Message) {
    const dialogRef = this.dialog.open(ConfirmDialogModalComponent, {
      width: '400px',
      data: {
        title: 'Delete message',
        message: 'Are you sure you want to delete this message? This action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        isDestructive: true,
      },
    });

    dialogRef.afterClosed().subscribe((result: boolean) => {
      if (result && message.id) {
        this.chatService.deleteMessage(message.id);
      }
    });
  }

  private scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop =
        this.scrollContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }

  viewImage(url: string) {
    window.open(url, '_blank');
  }

  loadMoreMessage() {
    const nextPage = this.chatService.pageNumber() + 1;
    this.chatService.loadMessages(nextPage);
  }

  private getOrCreateAudio(path: string): HTMLAudioElement {
    if (!this.audioElements.has(path)) {
      const audio = new Audio(path);
      this.audioProgress.set(path, 0);
      this.audioPlaying.set(path, false);

      audio.addEventListener('timeupdate', () => {
        const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
        this.audioProgress.set(path, pct);
        this.cdr.markForCheck();
      });

      audio.addEventListener('loadedmetadata', () => {
        this.audioDuration.set(path, this.formatAudioTime(audio.duration));
        this.cdr.markForCheck();
      });

      audio.addEventListener('ended', () => {
        this.audioPlaying.set(path, false);
        this.audioProgress.set(path, 0);
        audio.currentTime = 0;
        this.cdr.markForCheck();
      });

      this.audioElements.set(path, audio);
    }
    return this.audioElements.get(path)!;
  }

  toggleAudio(path: string) {
    const audio = this.getOrCreateAudio(path);

    // Pause any other playing audio
    this.audioElements.forEach((a, p) => {
      if (p !== path && !a.paused) {
        a.pause();
        this.audioPlaying.set(p, false);
      }
    });

    if (audio.paused) {
      audio.play();
      this.audioPlaying.set(path, true);
    } else {
      audio.pause();
      this.audioPlaying.set(path, false);
    }
    this.cdr.markForCheck();
  }

  seekAudio(event: MouseEvent, path: string) {
    const audio = this.getOrCreateAudio(path);
    if (!audio.duration) return;
    const bar = event.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
  }

  isAudioPlaying(path: string): boolean {
    return this.audioPlaying.get(path) ?? false;
  }

  getAudioProgress(path: string): number {
    return this.audioProgress.get(path) ?? 0;
  }

  getAudioDuration(path: string): string {
    return this.audioDuration.get(path) ?? '0:00';
  }

  getWaveformBars(path: string): number[] {
    if (!this.waveformCache.has(path)) {
      const hash = path.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const bars = Array.from({ length: 30 }, (_, i) => ((hash * (i + 1) * 37) % 14) + 2);
      this.waveformCache.set(path, bars);
    }
    return this.waveformCache.get(path)!;
  }

  private formatAudioTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  getCallLabel(msg: import('../../../../api/models/message').Message): string {
    const isMe = msg.senderId === this.authService.currentLoggedUser?.id;
    if (msg.callDurationSeconds !== null && msg.callDurationSeconds !== undefined) {
      return 'Відеодзвінок';
    }
    return isMe ? 'Виклик без відповіді' : 'Пропущений відеодзвінок';
  }

  getCallIconClass(msg: import('../../../../api/models/message').Message): string {
    const isMe = msg.senderId === this.authService.currentLoggedUser?.id;
    const isMissed = msg.callDurationSeconds === null || msg.callDurationSeconds === undefined;
    if (!isMissed) {
      return isMe ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]' : 'bg-white/20 text-white';
    }
    return isMe ? 'bg-red-500/15 text-red-500' : 'bg-red-500/20 text-red-200';
  }

  formatCallDuration(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  getBubbleClass(index: number): string {
    const messages = this.chatService.chatMessages();
    const currentMsg = messages[index];
    const prevMsg = messages[index - 1];
    const nextMsg = messages[index + 1];

    const isMe = currentMsg.senderId === this.authService.currentLoggedUser?.id;
    const isPrevSame = prevMsg && prevMsg.senderId === currentMsg.senderId;
    const isNextSame = nextMsg && nextMsg.senderId === currentMsg.senderId;

    let classes = 'px-3 py-2 md:px-4 md:py-2.5 transition-all duration-300 relative ';

    if (isMe) {
      classes += 'bg-mint text-gray-800 shadow-sm border border-mint/40 ';
    } else {
      classes += 'bg-primary text-white shadow-md shadow-primary/20 ';
    }

    classes += 'rounded-[18px] md:rounded-[20px] ';

    if (isMe) {
      if (isPrevSame) classes += '!rounded-tr-[4px] ';
      if (isNextSame) classes += '!rounded-br-[4px] ';
    } else {
      if (isPrevSame) classes += '!rounded-tl-[4px] ';
      if (isNextSame) classes += '!rounded-bl-[4px] ';
    }

    if (!isNextSame) {
      classes += 'mb-3 ';
    } else {
      classes += 'mb-0.5 ';
    }

    return classes;
  }
}