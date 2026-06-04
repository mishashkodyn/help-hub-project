import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { AiService } from '../../../../api/services/ai.service';
import { AuthService } from '../../../../api/services/auth.service';
import {
  AiAssistantAction,
  AiChatMessage,
} from '../../../../api/models/ai-chat-message';
import { AiChatRequest, AiMessage } from '../../../../api/models/ai-chat-request';

interface ParsedAiReply {
  reply: string;
  suggestions: string[];
  actions: AiAssistantAction[];
}

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
  private roles: string[] = [];
  private userCategory = '';
  // "Auto" lets the backend route between Groq (cheap default) and OpenAI (heavier asks).
  private provider = 'Auto';

  // Whitelist mapping the feature keys the model may return to real in-app routes.
  // The model can only navigate where we explicitly allow — unknown keys are dropped.
  private readonly featureRoutes: Record<string, { route: string; icon: string }> = {
    'find-psychologist': { route: '/catalog', icon: 'search' },
    'my-sessions': { route: '/my-sessions', icon: 'event' },
    'self-help': { route: '/practices', icon: 'spa' },
    breathing: { route: '/practices/box-breathing', icon: 'air' },
    grounding: { route: '/practices/grounding-54321', icon: 'self_improvement' },
    pmr: { route: '/practices/progressive-muscle', icon: 'accessibility_new' },
    chat: { route: '/chat', icon: 'forum' },
    'category-application': { route: '/category-application', icon: 'verified_user' },
    notifications: { route: '/notifications', icon: 'notifications' },
    settings: { route: '/settings', icon: 'settings' },
    'psychologist-dashboard': { route: '/psychologist', icon: 'dashboard' },
    'psychologist-calendar': { route: '/psychologist/calendar', icon: 'calendar_month' },
    'psychologist-sessions': { route: '/psychologist/sessions', icon: 'groups' },
    'psychologist-finances': { route: '/psychologist/finances', icon: 'payments' },
    'admin-dashboard': { route: '/admin', icon: 'shield' },
    'admin-applications': { route: '/admin/applications', icon: 'inbox' },
    'admin-payments': { route: '/admin/payments', icon: 'payments' },
  };

  // Forgiving aliases for near-miss keys the model may emit instead of the canonical ones.
  private readonly featureAliases: Record<string, string> = {
    'book-session': 'find-psychologist',
    'book-a-session': 'find-psychologist',
    'find-a-psychologist': 'find-psychologist',
    psychologist: 'find-psychologist',
    psychologists: 'find-psychologist',
    catalog: 'find-psychologist',
    sessions: 'my-sessions',
    'my-session': 'my-sessions',
    practices: 'self-help',
    'self-help-practices': 'self-help',
    techniques: 'self-help',
    'box-breathing': 'breathing',
    'breathing-exercise': 'breathing',
    'breathing-exercises': 'breathing',
    'grounding-54321': 'grounding',
    'grounding-technique': 'grounding',
    relaxation: 'pmr',
    'progressive-muscle': 'pmr',
    'progressive-muscle-relaxation': 'pmr',
    'category': 'category-application',
    'status-application': 'category-application',
    messages: 'chat',
    'psychologist-schedule': 'psychologist-calendar',
    schedule: 'psychologist-calendar',
    finances: 'psychologist-finances',
    admin: 'admin-dashboard',
    applications: 'admin-applications',
    payments: 'admin-payments',
  };

  constructor(
    private service: AiService,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.authService.getUserAIProveder().subscribe({
      next: (res) => {
        this.userName = `${res.data.name} ${res.data.surname}`.trim();
        this.roles = res.data.roles ?? [];
        this.userCategory = res.data.userCategory ?? '';
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
      context: 'Companion',
      messages: conversationHistory,
      roles: this.roles,
      userCategory: this.userCategory,
    };

    this.service.chatAsync(payload).subscribe({
      next: (response) => {
        const parsed = this.parseReply(response.data);
        this.messages.push({
          text: parsed.reply,
          isUser: false,
          timestamp: new Date(),
          suggestions: parsed.suggestions,
          actions: parsed.actions,
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

  /** A tapped quick-reply is sent as the user's next message. */
  sendSuggestion(text: string): void {
    if (this.isLoading) return;
    this.message = text;
    this.sendMessage();
  }

  /** A tapped feature button navigates into the app and closes the widget. */
  runAction(action: AiAssistantAction): void {
    this.router.navigateByUrl(action.route);
    this.close();
  }

  /**
   * Companion mode returns a strict JSON object. Parse it defensively and fall back to
   * treating the raw payload as plain markdown if anything is off.
   */
  private parseReply(raw: string): ParsedAiReply {
    const fallback: ParsedAiReply = { reply: raw ?? '', suggestions: [], actions: [] };
    if (!raw) return fallback;

    let text = raw.trim();
    const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenced) text = fenced[1].trim();
    if (!text.startsWith('{')) return fallback;

    try {
      const parsed = JSON.parse(text);
      const reply = typeof parsed.reply === 'string' ? parsed.reply : raw;

      const suggestions = Array.isArray(parsed.suggestions)
        ? parsed.suggestions
            .filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
            .map((s: string) => s.trim())
            .slice(0, 4)
        : [];

      const actions = Array.isArray(parsed.actions)
        ? parsed.actions
            .map((a: unknown) => this.resolveAction(a))
            .filter((a: AiAssistantAction | null): a is AiAssistantAction => a !== null)
            .slice(0, 3)
        : [];

      return { reply, suggestions, actions };
    } catch {
      return fallback;
    }
  }

  private resolveAction(raw: unknown): AiAssistantAction | null {
    if (!raw || typeof raw !== 'object') return null;
    const feature = (raw as { feature?: unknown }).feature;
    if (typeof feature !== 'string') return null;

    const key = feature.trim().toLowerCase().replace(/_/g, '-');
    const canonical = this.featureRoutes[key] ? key : this.featureAliases[key];
    const meta = canonical ? this.featureRoutes[canonical] : undefined;
    if (!meta) return null;

    const rawLabel = (raw as { label?: unknown }).label;
    const label =
      typeof rawLabel === 'string' && rawLabel.trim().length > 0
        ? rawLabel.trim()
        : feature;

    return { label, route: meta.route, icon: meta.icon };
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
