import { Injectable, signal } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
} from '@microsoft/signalr';
import { environment } from '../../../environments/environment';
import { AppNotification } from '../models/notification.model';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { ApiResponse } from '../models/api-response';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private baseUrl = `${environment.apiBaseUrl}/notification`;
  private hubUrl = `${environment.hubUrl}/notification`;
  private hubConnection?: HubConnection;

  notifications = signal<AppNotification[]>([]);
  unreadCount = signal<number>(0);
  isConnected = signal<boolean>(false);
  isLoading = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  markAsRead(id: string) {
    return this.http.put(`${this.baseUrl}/mark-as-read/${id}`, {}).pipe(
      tap(() => {
        this.unreadCount.update((count) => Math.max(0, count - 1));

        this.notifications.update((nots) =>
          nots.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        );
      }),
    );
  }

  markAllAsReadRequest() {
    return this.http.put(`${this.baseUrl}/mark-all-read`, null);
  }

  startConnection() {
    if (this.hubConnection?.state === HubConnectionState.Connected) return;

    this.isLoading.set(true);
    if (!this.hubConnection) {
      this.hubConnection = new HubConnectionBuilder()
        .withUrl(this.hubUrl, {
          accessTokenFactory: () => localStorage.getItem('token')!,
        })
        .withAutomaticReconnect()
        .build();
    }

    this.hubConnection.start().then(() => {
      this.isConnected.set(true);
      this.addListeners();

      this.hubConnection?.invoke('GetAllNotifications');
    });
  }

  stopConnection() {
    if (this.hubConnection) {
      this.hubConnection.stop().then(() => this.isConnected.set(false));
      this.notifications.set([]);
      this.unreadCount.set(0);
    }
  }

  private addListeners() {
    this.hubConnection?.on(
      'ReceiveAllNotifications',
      (notifications: AppNotification[]) => {
        this.notifications.set(notifications);

        const unread = notifications.filter((n) => !n.isRead).length;
        this.unreadCount.set(unread);
        this.isLoading.set(false);
      },
    );

    this.hubConnection?.on(
      'ReceiveNotification',
      (notification: AppNotification) => {
        this.notifications.update((nots) => [notification, ...nots]);

        this.unreadCount.update((count) => count + 1);
      },
    );
  }

  markAllAsRead() {
    this.unreadCount.set(0);
    this.notifications.update((nots) =>
      nots.map((n) => ({ ...n, isRead: true })),
    );

    this.markAllAsReadRequest().subscribe();
  }
}
