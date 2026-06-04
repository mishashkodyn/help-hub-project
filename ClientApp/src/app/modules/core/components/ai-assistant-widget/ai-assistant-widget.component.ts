import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { AiService } from '../../../../api/services/ai.service';
import { AuthService } from '../../../../api/services/auth.service';
import { AiChatMessage } from '../../../../api/models/ai-chat-message';
import { AiChatRequest, AiMessage } from '../../../../api/models/ai-chat-request';

@Component({
  selector: 'app-ai-assistant-widget',
  standalone: false,
  templateUrl: './ai-assistant-widget.component.html',
  styleUrl: './ai-assistant-widget.component.scss',
})
export class AiAssistantWidgetComponent implements OnInit {
  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLElement>;

  isOpen = false;
  message = '';
  messages: AiChatMessage[] = [];
  isLoading = false;

  private userName = '';
  // GROQ is the default provider for the floating assistant.
  private provider = 'Groq';

  constructor(
    private service: AiService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.authService.getUserAIProveder().subscribe({
      next: (res) => {
        this.userName = `${res.data.name} ${res.data.surname}`.trim();
      },
      error: () => {
        this.userName = 'Anonymous user';
      },
    });
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.scrollToBottom();
    }
  }

  close(): void {
    this.isOpen = false;
  }

  clear(): void {
    this.messages = [];
  }

  sendMessage(): void {
    const text = this.message.trim();
    if (!text || this.isLoading) return;

    this.messages.push({ text, isUser: true, timestamp: new Date() });
    this.message = '';
    this.isLoading = true;
    this.scrollToBottom();

    const conversationHistory: AiMessage[] = this.messages.slice(-10).map((msg) => ({
      role: msg.isUser ? 'user' : 'assistant',
      content: msg.text,
    }));

    const payload: AiChatRequest = {
      userName: this.userName,
      provider: this.provider,
      messages: conversationHistory,
    };

    this.service.chatAsync(payload).subscribe({
      next: (response) => {
        this.messages.push({
          text: response.data,
          isUser: false,
          timestamp: new Date(),
        });
        this.isLoading = false;
        this.scrollToBottom();
      },
      error: () => {
        this.messages.push({
          text: 'AI did not answer. Please try again.',
          isUser: false,
          timestamp: new Date(),
        });
        this.isLoading = false;
        this.scrollToBottom();
      },
    });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      try {
        const el = this.scrollContainer?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      } catch {}
    });
  }
}
