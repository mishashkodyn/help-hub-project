import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
} from '@microsoft/signalr';
import { AuthService } from './auth.service';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { FilesService } from './files.service';
import { VideoChatComponent } from '../../modules/chat/components/video-chat/video-chat.component';
import { MatDialog } from '@angular/material/dialog';
import { untilDestroyed } from '@ngneat/until-destroy';
import { UntilDestroy } from '@ngneat/until-destroy';

@Injectable({
  providedIn: 'root',
})
@UntilDestroy()
export class VideoChatService {
  private hubUrl = `${environment.hubUrl}/video`;
  public hubConnection: HubConnection | null = null;

  public offerReceived = new Subject<{
    senderId: string;
    offer: RTCSessionDescriptionInit;
  }>();
  public answerReceived = new Subject<{
    senderId: string;
    answer: RTCSessionDescriptionInit;
  }>();
  public iceCandidateReceived = new Subject<{
    senderId: string;
    candidate: RTCIceCandidateInit;
  }>();
  public callEnded = new Subject<void>();
  public incomingCall = false;
  public isCallActive = false;
  public remoteUserId: string | null = null;
  matDialog = inject(MatDialog);
  isConnected = signal<boolean>(false);

  async startConnection() {
    console.log('VIDEOOOOOOOOOOOOOOOOOOOOOOOOOOOOO');

    if (this.hubConnection?.state === HubConnectionState.Connected) return;

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(this.hubUrl, {
        accessTokenFactory: () => localStorage.getItem('token')!,
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('ReceiveOffer', (senderId, offer) => {
      const parsedOffer = typeof offer === 'string' ? JSON.parse(offer) : offer;
      this.offerReceived.next({ senderId, offer: parsedOffer });
    });

    this.hubConnection.on('ReceiveAnswer', (senderId, answer) => {
      const parsedAnswer =
        typeof answer === 'string' ? JSON.parse(answer) : answer;
      this.answerReceived.next({ senderId, answer: parsedAnswer });
    });

    this.hubConnection.on('ReceiveIceCandidate', (senderId, candidate) => {
      const parsedCandidate =
        typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
      this.iceCandidateReceived.next({ senderId, candidate: parsedCandidate });
    });

    this.hubConnection.on('CallEnded', () => {
      this.callEnded.next();
    });

    this.hubConnection
      .start()
      .then(() => {
        this.startOfferReceive();
        this.isConnected.set(true);
      })
      .catch((error) =>
        console.error('Video Chat Hub Connection Error: ', error),
      );
  }

  stopConnection() {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      this.hubConnection.stop().then(() => this.isConnected.set(false));
    }
  }

  startOfferReceive() {
    this.offerReceived.pipe(untilDestroyed(this)).subscribe((data) => {
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
    });
  }

  async sendOffer(receiverId: string, offer: RTCSessionDescriptionInit) {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      await this.hubConnection.invoke(
        'SendOffer',
        receiverId,
        JSON.stringify(offer),
      );
    }
  }

  async sendAnswer(receiverId: string, answer: RTCSessionDescriptionInit) {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      await this.hubConnection.invoke(
        'SendAnswer',
        receiverId,
        JSON.stringify(answer),
      );
    }
  }

  async sendIceCandidate(receiverId: string, candidate: RTCIceCandidate) {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      await this.hubConnection.invoke(
        'SendIceCandidate',
        receiverId,
        JSON.stringify(candidate),
      );
    }
  }

  async sendEndCall(receiverId: string) {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      await this.hubConnection.invoke('EndCall', receiverId);
    }
  }
}
