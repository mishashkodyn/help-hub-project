import { inject, Injectable, signal } from '@angular/core';
import { User } from '../models/user';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { Message } from '../models/message';
import { environment } from '../../../environments/environment';
import { PresenceService } from './presence-service';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private hubUrl = `${environment.hubUrl}/chat`;
  private hubConnection?: HubConnection;
  private typingTimeouts = new Map<string, any>();

  currentOpenedChat = signal<User | null>(null);
  chatMessages = signal<Message[]>([]);
  isLoading = signal<boolean>(false);
  autoScrollEnabled = signal<boolean>(true);
  pageNumber = signal<number>(1);
  isConnected = signal<boolean>(false);
  chatRightSidebarIsOpen = signal<boolean>(false);
  replyMessage = signal<Message | null>(null);
  presenceService = inject(PresenceService);

  constructor() {}

  startConnection(contactId?: string) {
    if (this.hubConnection?.state === HubConnectionState.Connected) return;

    const url = contactId ? `${this.hubUrl}?contactId=${contactId}` : this.hubUrl;

    if (!this.hubConnection) {
      this.hubConnection = new HubConnectionBuilder()
        .withUrl(url, { accessTokenFactory: () => localStorage.getItem('token')! })
        .withAutomaticReconnect()
        .build();

      this.registerHubEvents();
    }

    this.hubConnection
      .start()
      .then(() => this.isConnected.set(true))
      .catch((error) => console.error('Chat Hub Error: ', error));
  }

  private registerHubEvents() {
    this.hubConnection!.on('NotifyTypingToUser', (senderUserName: string) => {
      this.presenceService.usersList.update((users) =>
        users.map((u) => (u.userName === senderUserName ? { ...u, isTyping: true } : u))
      );

      if (this.typingTimeouts.has(senderUserName)) {
        clearTimeout(this.typingTimeouts.get(senderUserName));
      }

      const timeout = setTimeout(() => {
        this.presenceService.usersList.update((users) =>
          users.map((u) => (u.userName === senderUserName ? { ...u, isTyping: false } : u))
        );
        this.typingTimeouts.delete(senderUserName);
      }, 3000);

      this.typingTimeouts.set(senderUserName, timeout);
    });

    this.hubConnection!.on('ReceiveMessageList', (data: { messages: Message[], page: number }) => {
      if (data.page === 1) {
        this.chatMessages.set(data.messages);
      } else {
        this.chatMessages.update((msgs) => [...data.messages, ...msgs]);
      }
    });

   this.hubConnection!.on('ReceiveNewMessage', (message: Message) => {
      const currentChat = this.currentOpenedChat();
      const myUserId = localStorage.getItem('myUserId');
      
      if (message.receiverId === myUserId) { 
         const audio = new Audio('assets/notification.mp3');
         audio.play().catch(e => console.warn('Audio play blocked', e));
      }

      if (message.senderId === currentChat?.id || message.receiverId === currentChat?.id) {
        
        if (message.senderId === currentChat?.id) {
           message.isRead = true;
           
           this.hubConnection?.invoke('MarkChatAsRead', currentChat!.id);
        }
        
        this.chatMessages.update((msgs) => [...msgs, message]);
      } else {
        this.presenceService.usersList.update(users => 
           users.map(u => u.id === message.senderId ? { ...u, unreadCount: (u.unreadCount || 0) + 1 } : u)
        );
      }
    });

    this.hubConnection!.on('MessagesMarkedAsRead', (readerId: string) => {
      this.chatMessages.update(msgs => msgs.map(m => 
        m.receiverId === readerId ? { ...m, isRead: true } : m
      ));
    });
  }

  stopConnection() {
    this.hubConnection?.stop().then(() => this.isConnected.set(false));
  }

  loadMessages(pageNumber: number) {
    if (!this.currentOpenedChat() || !this.isConnected()) return;

    this.isLoading.set(true);
    this.hubConnection
      ?.invoke('LoadMessages', this.currentOpenedChat()?.id, pageNumber)
      .finally(() => this.isLoading.set(false));
  }

  async sendMessageHub(messageContent: string, attachments: any[]) {
    return this.hubConnection?.invoke('SendMessage', {
      receiverId: this.currentOpenedChat()?.id,
      content: messageContent,
      replyMessageId: this.replyMessage()?.id,
      attachments: attachments,
    });
  }

  notifyTyping() {
    this.hubConnection?.invoke('NotifyTyping', this.currentOpenedChat()?.id);
  }
}