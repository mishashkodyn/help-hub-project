import { Component, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../../api/services/auth.service';
import { Router } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { ChatService } from '../../../../api/services/chat.service';
import { User } from '../../../../api/models/user';
import { TypingIndicatorComponent } from '../../../shared/typing-indicator/typing-indicator.component';
import { PresenceService } from '../../../../api/services/presence-service';

@Component({
  selector: 'app-chat-sidebar',
  standalone: false,
  templateUrl: './chat-sidebar.component.html',
  styles: ``,
})
export class ChatSidebarComponent implements OnInit {
  constructor(
    protected authService: AuthService,
    private router: Router,
    protected chatService: ChatService,
    protected presenceService: PresenceService
  ) {}

  logout() {
    this.authService.logout();
  }

  ngOnInit(): void {
    // this.chatService.startConnection(this.authService.getAccessToken!)
  }

  openChatWindow(user: User) {
    this.chatService.chatRightSidebarIsOpen.set(false);
    this.chatService.currentOpenedChat.set(user);
    this.chatService.loadMessages(1);

    this.presenceService.usersList.update(users =>
      users.map(u => u.userName === user.userName ? { ...u, unreadCount: 0 } : u)
    );
  }
}
