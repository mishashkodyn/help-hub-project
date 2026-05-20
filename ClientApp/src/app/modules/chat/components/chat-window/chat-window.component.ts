import { Component, EventEmitter, inject, Output, ViewChild, ElementRef } from '@angular/core';
import { ChatService } from '../../../../api/services/chat.service';
import { Location, TitleCasePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
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
  styles: `
    @keyframes voiceBar {
      0%   { transform: scaleY(0.2); }
      100% { transform: scaleY(1); }
    }
    .voice-rec-bar {
      transform-origin: bottom center;
      animation: voiceBar 0.55s ease-in-out infinite alternate;
    }
    mat-icon {
      line-height: 1 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
  `,
})
export class ChatWindowComponent {
  @ViewChild('chatBox') chatContainer?: ElementRef;
  @Output() viewMedia = new EventEmitter<{ url: string; type: 'image' | 'video' }>();
  dialog = inject(MatDialog);
  signalRService = inject(VideoChatService);
  message: string = '';
  selectedFiles: { file: File; preview: string }[] = [];

  voiceState: 'idle' | 'recording' = 'idle';
  recordingSeconds = 0;
  private mediaRecorder?: MediaRecorder;
  private recordingInterval?: any;
  private recordedChunks: Blob[] = [];
  private _isCancellingRecording = false;

  readonly recBars = [
    { h: 6,  d: 0   }, { h: 14, d: 80  }, { h: 9,  d: 160 },
    { h: 16, d: 40  }, { h: 11, d: 120 }, { h: 5,  d: 200 },
    { h: 14, d: 60  }, { h: 8,  d: 140 }, { h: 16, d: 20  },
    { h: 10, d: 100 }, { h: 13, d: 180 }, { h: 7,  d: 260 },
  ];

  constructor(
    protected chatService: ChatService,
    private filesService: FilesService,
    private authService: AuthService,
    private location: Location,
    private route: ActivatedRoute,
  ) {}

  get showBackToOrigin(): boolean {
    return this.route.snapshot.queryParamMap.has('back');
  }

  openMedia(url: string, type: 'image' | 'video') {
    this.viewMedia.emit({ url, type });
  }

  displayDialog(receiverId?: string) {
    this.dialog.open(VideoChatComponent, {
      maxWidth: '100vw',
      maxHeight: '100vh',
      panelClass: 'video-chat-dialog',
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

  goBack() {
    this.chatService.currentOpenedChat.set(null);
    this.chatService.chatRightSidebarIsOpen.set(false);
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.location.go('/');
    }
  }

  openRightSideBar() {
    this.chatService.chatRightSidebarIsOpen.set(true);
  }

  async sendMessage() {
    if (!this.message?.trim() && this.selectedFiles.length === 0) return;

    const contentToSend = this.message;
    const filesToSend = this.selectedFiles.map((f) => f.file);
    const filePreviews = [...this.selectedFiles];
    const me = this.authService.currentLoggedUser;
    const replyMsg = this.chatService.replyMessage();

    this.message = '';
    this.selectedFiles = [];

    const optimisticAttachments = filePreviews.map((f) => ({
      path: f.preview,
      type: f.file.type.startsWith('image') ? 'image' :
            f.file.type.startsWith('video') ? 'video' :
            f.file.type.startsWith('audio') ? 'audio' : 'file',
      name: f.file.name,
    }));

    const localId = `pending-${Date.now()}`;

    this.chatService.chatMessages.update(msgs => [...msgs, {
      localId,
      isPending: true,
      senderId: me?.id,
      senderName: me?.name ?? '',
      receiverId: this.chatService.currentOpenedChat()?.id,
      content: contentToSend,
      createdDate: new Date().toISOString(),
      isRead: false,
      replyMessageId: replyMsg?.id,
      replyMessageContent: replyMsg?.content ?? undefined,
      replyMessageSenderName: replyMsg?.senderName,
      attachments: optimisticAttachments,
    }]);

    try {
      let uploadedAttachments: any[] = [];

      if (filesToSend.length > 0) {
        uploadedAttachments = await lastValueFrom(
          this.filesService.uploadFiles(filesToSend),
        );
      }

      this.chatService.registerOutgoing(localId);
      await this.chatService.sendMessageHub(contentToSend, uploadedAttachments);
      this.chatService.replyMessage.set(null);
    } catch (error) {
      console.error('Помилка відправки:', error);
      this.chatService.deregisterOutgoing(localId);
      this.chatService.chatMessages.update(msgs => msgs.filter(m => m.localId !== localId));
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

  async startRecording() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      console.error('Microphone access denied');
      return;
    }

    this.recordedChunks = [];
    this._isCancellingRecording = false;

    const options = MediaRecorder.isTypeSupported('audio/webm') ? { mimeType: 'audio/webm' } : {};
    this.mediaRecorder = new MediaRecorder(stream, options);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (this._isCancellingRecording) {
        this._isCancellingRecording = false;
        this.recordedChunks = [];
        return;
      }
      const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
      const blob = new Blob(this.recordedChunks, { type: mimeType });
      this.recordedChunks = [];
      this.sendVoiceBlob(blob, mimeType);
    };

    this.mediaRecorder.start();
    this.voiceState = 'recording';
    this.recordingSeconds = 0;
    this.recordingInterval = setInterval(() => this.recordingSeconds++, 1000);
  }

  stopRecording() {
    clearInterval(this.recordingInterval);
    this.recordingSeconds = 0;
    this.voiceState = 'idle';
    this.mediaRecorder?.stop();
  }

  cancelRecording() {
    this._isCancellingRecording = true;
    clearInterval(this.recordingInterval);
    this.recordingSeconds = 0;
    this.voiceState = 'idle';
    this.mediaRecorder?.stop();
  }

  private async sendVoiceBlob(blob: Blob, mimeType: string) {
    const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType });
    const localUrl = URL.createObjectURL(blob);
    const localId = `pending-${Date.now()}`;
    const me = this.authService.currentLoggedUser;

    this.chatService.chatMessages.update(msgs => [...msgs, {
      localId,
      isPending: true,
      senderId: me?.id,
      senderName: me?.name,
      receiverId: this.chatService.currentOpenedChat()?.id,
      content: '',
      createdDate: new Date().toISOString(),
      isRead: false,
      attachments: [{ path: localUrl, type: 'audio', name: file.name }],
    }]);

    try {
      const uploaded = await lastValueFrom(this.filesService.uploadFiles([file]));
      this.chatService.registerOutgoing(localId);
      await this.chatService.sendMessageHub('', uploaded);
    } catch (e) {
      console.error('Failed to send voice message:', e);
      this.chatService.deregisterOutgoing(localId);
      this.chatService.chatMessages.update(msgs => msgs.filter(m => m.localId !== localId));
    } finally {
      URL.revokeObjectURL(localUrl);
    }
  }

  handleSendButton() {
    this.sendMessage();
  }

  formatRecordingTime(sec: number): string {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}
