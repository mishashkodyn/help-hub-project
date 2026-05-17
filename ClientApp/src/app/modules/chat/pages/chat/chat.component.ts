import { Component, OnDestroy } from '@angular/core';
import { ChatSidebarComponent } from '../../components/chat-sidebar/chat-sidebar.component';
import { ChatWindowComponent } from '../../components/chat-window/chat-window.component';
import { ChatRightSidebarComponent } from '../../components/chat-right-sidebar/chat-right-sidebar.component';
import { ChatService } from '../../../../api/services/chat.service';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogModalComponent } from '../../../shared/confirm-dialog-modal/confirm-dialog-modal.component';

@Component({
  selector: 'app-chat',
  standalone: false,
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent implements OnDestroy {
  activeVideoUrl: string | null = null;
  activeMedia: { url: string; type: 'image' | 'video' } | null = null;
  actionMessage: string | null = null;

  constructor(
    protected chatService: ChatService,
    private dialog: MatDialog,
  ) {}

  ngOnDestroy(): void {
    this.chatService.chatRightSidebarIsOpen.set(false);
    this.chatService.currentOpenedChat.set(null);
  }

  openMedia(url: string, type: 'image' | 'video') {
    this.activeMedia = { url, type };
  }

  closeMedia() {
    this.activeMedia = null;
  }

  openConfirmAction(action: string) {
    switch (action) {
      case 'clearConversation':
        const dialogRef = this.dialog.open(ConfirmDialogModalComponent, {
          width: '400px',
          data: {
            title: 'Clear conversation',
            message:
              'Are you sure you want to clear this entire conversation? This action cannot be undone and messages will be permanently deleted.',
            confirmText: 'Clear Chat',
            cancelText: 'Cancel',
            isDestructive: true,
          },
        });

        dialogRef.afterClosed().subscribe((result: boolean) => {
          if (result) {
            this.chatService.clearConversation();
          }
        });
        break;
      default:
        return;
    }
  }
}
