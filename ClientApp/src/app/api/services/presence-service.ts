import { computed, Injectable, signal } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
} from '@microsoft/signalr';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { User } from '../models/user';

@Injectable({
  providedIn: 'root',
})
export class PresenceService {
  private hubUrl = `${environment.hubUrl}/online-users`;
  private hubConnection?: HubConnection;

  usersList = signal<User[]>([]);
  totalUnreadCount = computed(() => {
    return this.usersList().reduce((total, user) => total + (user.unreadCount || 0), 0);
  });
  isConnected = signal<boolean>(false);
  constructor() {}

  startConnection() {
    console.log('PRESENCE CONN');

    if (this.hubConnection?.state === HubConnectionState.Connected) return;

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(this.hubUrl, {
        accessTokenFactory: () => localStorage.getItem('token')!,
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .then(() => this.isConnected.set(true))
      .catch((error) => console.error('Presence Hub Error: ', error));

    this.hubConnection.on('ReceiveAllUsers', (users: User[]) => {
      this.usersList.set(users);
    });

    this.hubConnection.on('UserStatusChanged', (changedUser: User) => {
      this.usersList.update(currentUsers => {
        const index = currentUsers.findIndex(u => u.userName === changedUser.userName);
        
        if (index !== -1) {
          const updatedUsers = [...currentUsers];
          updatedUsers[index] = { ...updatedUsers[index], isOnline: changedUser.isOnline };
          
          return updatedUsers.sort((a, b) => Number(b.isOnline) - Number(a.isOnline));
          
        } else {
          return [...currentUsers, changedUser];
        }
      });
    });

    this.hubConnection.on('Notify', (user: User) => {
      this.showOnlineNotification(user);
    });
  }

  stopConnection() {
    console.log('PRESENCE STOP');
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      this.hubConnection.stop().then(() => this.isConnected.set(false));
    }
  }

  private showOnlineNotification(user: User) {
    if (Notification.permission === 'granted') {
      new Notification('Active now 🟢', {
        body: `${user.name} ${user.surname} is online now`,
        icon: user.profileImage,
      });
    }
  }
}
