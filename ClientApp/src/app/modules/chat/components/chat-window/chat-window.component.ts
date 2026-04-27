import { Component, ElementRef, EventEmitter, inject, Output, ViewChild } from '@angular/core';
import { ChatService } from '../../../../api/services/chat.service';
import { TitleCasePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ChatBoxComponent } from '../chat-box/chat-box.component';
import { VideoChatService } from '../../../../api/services/video-chat.service';
import { MatDialog } from '@angular/material/dialog';
import { VideoChatComponent } from '../video-chat/video-chat.component';
import { lastValueFrom } from 'rxjs';
import { FilesService } from '../../../../api/services/files.service';
import { AuthService } from '../../../../api/services/auth.service';

@Component({
  selector: 'app-chat-window',
  standalone: false,
  templateUrl: './chat-window.component.html',
  styles: ``,
})
export class ChatWindowComponent {
  @ViewChild('chatBox') chatContainer?: ElementRef;
  @Output() viewMedia = new EventEmitter<{ url: string; type: 'image' | 'video' }>();
  dialog = inject(MatDialog);
  signalRService = inject(VideoChatService);
  message: string = '';
  selectedFiles: { file: File; preview: string }[] = [];

  constructor(
    protected chatService: ChatService,
    private filesService: FilesService,
  ) {}

  openMedia(url: string, type: 'image' | 'video') {
    this.viewMedia.emit({ url, type });
  }

  displayDialog(receiverId?: string) {
    this.dialog.open(VideoChatComponent, {
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

  closeChatWindow() {
    this.chatService.currentOpenedChat.set(null);
  }

  openRightSideBar() {
    this.chatService.chatRightSidebarIsOpen.set(true);
  }

  async sendMessage() {
    if (!this.message?.trim() && this.selectedFiles.length === 0) return;

    const contentToSend = this.message;
    const filesToSend = this.selectedFiles.map((f) => f.file);
    this.message = '';
    
    const replyId = this.chatService.replyMessage()?.id;
    const replyContent = this.chatService.replyMessage()?.content;
    const replySender = this.chatService.replyMessage()?.senderName;

    const tempAttachments = filesToSend.map((file, index) => ({
      path: this.selectedFiles[index]?.preview,
      type: file.type.startsWith('image') ? 'image' : 'file',
      name: file.name,
    }));

    this.selectedFiles = [];

    setTimeout(() => {
      this.scrollToBottom();
    }, 50);

    // this.chatService.chatMessages.update((messages) => [
    //   ...messages,
    //   {
    //     content: contentToSend,
    //     senderId: this.authService.currentLoggedUser!.id,
    //     receiverId: this.chatService.currentOpenedChat()?.id!,
    //     createdDate: new Date().toString(),
    //     isRead: false,
    //     replyMessageId: replyId,
    //     replyMessageContent: replyContent ?? undefined,
    //     replyMessageSenderName: replySender,
    //     attachments: tempAttachments,
    //   },
    // ]);

    try {
      let uploadedAttachments: any[] = [];

      if (filesToSend.length > 0) {
        uploadedAttachments = await lastValueFrom(
          this.filesService.uploadFiles(filesToSend),
        );
      }

      await this.chatService.sendMessageHub(contentToSend, uploadedAttachments);
    } catch (error) {
      console.error('Помилка відправки:', error);
    }
  }

  private scrollToBottom() {
    if (this.chatContainer) {
      this.chatContainer.nativeElement.scrollTop =
        this.chatContainer.nativeElement.scrollHeight;
    }
  }

  onFileSelected(event: any) {
    const files = event.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = (e) => {
          this.selectedFiles.push({
            file,
            preview: e.target!.result as string,
          });
        };
        reader.readAsDataURL(file);
      }
    }
    event.target.value = '';
  }

  get paddingTopClass(): string {
    if (this.selectedFiles.length > 0 && this.chatService.replyMessage()) {
      return 'pt-40';
    } else if (this.selectedFiles.length > 0) {
      return 'pt-24';
    } else if (this.chatService.replyMessage()) {
      return 'pt-16';
    } else {
      return 'pt-3';
    }
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  isImage(file: File): boolean {
    return file.type.startsWith('image/');
  }

  getFileIcon(file: File): string {
    if (file.type.startsWith('video/')) return 'movie';
    if (file.type.startsWith('audio/')) return 'audiotrack';
    if (file.type.includes('pdf')) return 'picture_as_pdf';
    if (
      file.type.includes('spreadsheet') ||
      file.type.includes('excel') ||
      file.name.endsWith('.csv')
    )
      return 'table_view';
    if (file.type.includes('word') || file.type.includes('document'))
      return 'description';
    if (file.type.includes('presentation') || file.type.includes('powerpoint'))
      return 'slideshow';
    if (file.type.includes('zip') || file.type.includes('compressed'))
      return 'folder_zip';
    return 'insert_drive_file';
  }

  getFileIconColor(file: File): string {
    if (file.type.startsWith('video/')) return 'text-red-500';
    if (file.type.includes('pdf')) return 'text-red-600';
    if (file.type.includes('excel') || file.type.includes('spreadsheet'))
      return 'text-green-600';
    if (file.type.includes('word')) return 'text-blue-600';
    return 'text-gray-500';
  }
}
