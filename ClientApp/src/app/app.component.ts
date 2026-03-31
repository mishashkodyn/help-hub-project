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
export class AppComponent implements OnInit, OnDestroy {
  title = 'client';

  public signalRService = inject(VideoChatService);
  public authService = inject(AuthService);
  public presenceService = inject(PresenceService);
  public chatService = inject(ChatService);
  private matDialog = inject(MatDialog);
  private notificationService = inject(NotificationService);
  private sub = new Subscription();

  ngOnInit(): void {
    if (!this.authService.getAccessToken) {
      return;
    }
    this.signalRService.startConnection().then(() => {
      this.startOfferReceive();
    });
    this.presenceService.startConnection();
    this.chatService.startConnection();
    this.notificationService.startConnection();
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  // 1. ВИПРАВЛЕННЯ ДЛЯ ВХІДНОГО ДЗВІНКА
  startOfferReceive() {
    this.sub.add(
      this.signalRService.offerReceived.subscribe((data) => {
        if (data && data.senderId) {
          this.matDialog.open(VideoChatComponent, {
            width: '600px',
            height: '600px',
            disableClose: true,
            data: {
              isCaller: false,
              offer: data.offer,
              remoteUserId: data.senderId,
            },
          });
        }
      }),
    );
  }

  displayDialog(receiverId?: string) {
    if (!receiverId) {
      console.error('No receiverId provided');
      return;
    }

    this.matDialog.open(VideoChatComponent, {
      width: '600px',
      height: '600px',
      disableClose: true,
      autoFocus: false,
      data: {
        isCaller: true,
        remoteUserId: receiverId,
      },
    });
  }
}
