import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { AiChatRequest, AiMessage } from '../../../../api/models/ai-chat-request';
import { AiChatMessage } from '../../../../api/models/ai-chat-message';
import { AiService } from '../../../../api/services/ai.service';
import { timestamp } from 'rxjs';
import { AuthService } from '../../../../api/services/auth.service';

@Component({
  selector: 'app-ai-chat',
  templateUrl: './ai-chat.component.html',
  styleUrl: './ai-chat.component.scss',
  standalone: false,
})
export class AiChatComponent implements OnInit {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  message: string = '';
  messages: AiChatMessage[] = [];
  isLoading: boolean = false;
  private userName: string = '';
  private provider: string = 'Groq';

  constructor(private service: AiService, private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.getUserAIProveder().subscribe( {
      next: (res) => {
        this.userName = res.data.name + " " + res.data.surname;
        this.provider = res.data.preferredAiProvider;
      },
      error: () => {
        this.userName = "Anonymous user";
        this.provider = "None";
      }
    })
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  sendMessage() {
    if (this.message == null) return;

    const userMsg: AiChatMessage = {
      text: this.message,
      isUser: true,
      timestamp: new Date(),
    };
    this.messages.push(userMsg);
    this.scrollToBottom();    
    this.message = '';
    this.isLoading = true;

    const conversationHistory: AiMessage[] = this.messages.slice(-10).map(msg =>({
      role: msg.isUser ? "user" : "assistant",
      content: msg.text
    }));

    const payload: AiChatRequest = {
      userName: this.userName,
      provider: this.provider,
      messages: conversationHistory
    }

    this.service.chatAsync(payload).subscribe({
      next: (response) => {
        this.messages.push({
          text: response.data,
          isUser: false,
          timestamp: new Date(),
        });
        this.isLoading = false;
      },
      error: () => {
        this.messages.push({
          text: "AI did't answer",
          isUser: false,
          timestamp: new Date(),
        });
        this.isLoading = false;
      },
    });
  }

  private scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop =
        this.scrollContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }
}
