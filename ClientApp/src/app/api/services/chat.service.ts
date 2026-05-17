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
  private outgoingQueue: string[] = [];

  constructor() {}

  registerOutgoing(localId: string) {
    this.outgoingQueue.push(localId);
  }

  deregisterOutgoing(localId: string) {
    const idx = this.outgoingQueue.indexOf(localId);
    if (idx !== -1) this.outgoingQueue.splice(idx, 1);
  }

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

    this.hubConnection!.on('ChatClearedByPartner', (partnerId: string) => {
      if (this.currentOpenedChat()?.id === partnerId) {
        this.chatMessages.set([]); 
      }
    });

   this.hubConnection!.on('ReceiveNewMessage', (message: Message) => {
      const currentChat = this.currentOpenedChat();
      const myUserId = (JSON.parse(localStorage.getItem('user') || '{}') as any)?.id as string | undefined;

      if (message.receiverId?.toLowerCase() === myUserId?.toLowerCase()) {
         const audio = new Audio('assets/notification.mp3');
         audio.play().catch(e => console.warn('Audio play blocked', e));
      }

      const chatId = currentChat?.id?.toLowerCase();
      if (message.senderId?.toLowerCase() === chatId || message.receiverId?.toLowerCase() === chatId) {
        if (message.senderId?.toLowerCase() === myUserId?.toLowerCase()) {
          const pendingId = this.outgoingQueue.shift();
          if (pendingId) {
            this.chatMessages.update(msgs => msgs.filter(m => m.localId !== pendingId));
          }
        }

        if (message.senderId?.toLowerCase() === chatId) {
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

    this.hubConnection!.on('MessageDeleted', (messageId: string) => {
      this.chatMessages.update(msgs => msgs.filter(m => m.id !== messageId));
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

  deleteMessage(messageId: string) {
    if (!this.isConnected()) return;
    this.hubConnection?.invoke('DeleteMessage', messageId)
      .catch((err) => console.error('Failed to delete message:', err));
  }

  saveCallRecord(contactId: string, durationSeconds: number | null) {
    if (!this.isConnected()) return;
    this.hubConnection?.invoke('SaveCallRecord', contactId, durationSeconds)
      .catch((err) => console.error('Failed to save call record:', err));
  }

  clearConversation() {
    const contactId = this.currentOpenedChat()?.id;
    if (!contactId || !this.isConnected()) return;

    this.hubConnection?.invoke('ClearChatHistory', contactId)
      .then(() => {
        this.chatMessages.set([]);
        
      })
      .catch((err) => {
        console.error('Failed to clear chat history:', err);
      });
  }
}