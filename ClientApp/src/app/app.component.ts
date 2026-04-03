import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { VideoChatService } from './api/services/video-chat.service';
import { AuthService } from './api/services/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { VideoChatComponent } from './modules/chat/components/video-chat/video-chat.component';
import { ChatService } from './api/services/chat.service'; // Додав ChatService, бо він у тебе в HTML
import { Subscription } from 'rxjs';
import { PresenceService } from './api/services/presence-service';
import { NotificationService } from './api/services/notification.service';

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'client';

  public videoChatService = inject(VideoChatService);
  public authService = inject(AuthService);
  public presenceService = inject(PresenceService);
  public chatService = inject(ChatService);
  private notificationService = inject(NotificationService);

  ngOnInit(): void {
    if (!this.authService.getAccessToken) {
      return;
    }
     if (!this.presenceService.isConnected()) {
      this.presenceService.startConnection();
    }
    if (!this.chatService.isConnected()) {
      this.chatService.startConnection();
    }
    if (!this.notificationService.isConnected()){
      this.notificationService.startConnection();
    }
    if (!this.videoChatService.isConnected()){
      this.videoChatService.startConnection();
    }
  }
  // 1. ВИПРАВЛЕННЯ ДЛЯ ВХІДНОГО ДЗВІНКА
}
