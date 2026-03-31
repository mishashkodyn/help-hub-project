import { Component, OnDestroy } from '@angular/core';
import { ChatSidebarComponent } from "../../components/chat-sidebar/chat-sidebar.component";
import { ChatWindowComponent } from "../../components/chat-window/chat-window.component";
import { ChatRightSidebarComponent } from "../../components/chat-right-sidebar/chat-right-sidebar.component";
import { ChatService } from '../../../../api/services/chat.service';

@Component({
  selector: 'app-chat',
  standalone: false,
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent implements OnDestroy {
  constructor(protected chatService: ChatService) {
  }

  ngOnDestroy(): void {
    this.chatService.chatRightSidebarIsOpen.set(false);
    this.chatService.currentOpenedChat.set(null);
  }
}
