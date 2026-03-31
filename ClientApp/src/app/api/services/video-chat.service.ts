  import { inject, Injectable } from '@angular/core';
  import { environment } from '../../../environments/environment';
  import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
  import { AuthService } from './auth.service';
  import { BehaviorSubject, Subject } from 'rxjs';
import { FilesService } from './files.service';

  @Injectable({
    providedIn: 'root',
  })
  export class VideoChatService {
    private hubUrl = `${environment.hubUrl}/video`;
    public hubConnection: HubConnection | null = null;
    private authService = inject(AuthService);
    private filesService = inject(FilesService)

    public offerReceived = new Subject<{ senderId: string; offer: RTCSessionDescriptionInit }>();
    public answerReceived = new Subject<{ senderId: string; answer: RTCSessionDescriptionInit }>();
    public iceCandidateReceived = new Subject<{ senderId: string; candidate: RTCIceCandidateInit }>();
    public callEnded = new Subject<void>();

    public incomingCall = false;
    public isCallActive = false;
    public remoteUserId: string | null = null;

    async startConnection() {
      if (this.hubConnection?.state === HubConnectionState.Connected) return;

      this.hubConnection = new HubConnectionBuilder()
        .withUrl(this.hubUrl, {
          accessTokenFactory: () => this.authService.getAccessToken!,
        })
        .withAutomaticReconnect()
        .build();

      this.hubConnection.on('ReceiveOffer', (senderId, offer) => {
        const parsedOffer = typeof offer === 'string' ? JSON.parse(offer) : offer;
        this.offerReceived.next({ senderId, offer: parsedOffer });
      });

      this.hubConnection.on('ReceiveAnswer', (senderId, answer) => {
        const parsedAnswer = typeof answer === 'string' ? JSON.parse(answer) : answer;
        this.answerReceived.next({ senderId, answer: parsedAnswer });
      });

      this.hubConnection.on('ReceiveIceCandidate', (senderId, candidate) => {
        const parsedCandidate = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
        this.iceCandidateReceived.next({ senderId, candidate: parsedCandidate });
      });

      this.hubConnection.on('CallEnded', () => {
        this.callEnded.next();
      });

      await this.hubConnection.start();
    }

    async sendOffer(receiverId: string, offer: RTCSessionDescriptionInit) {
      if (this.hubConnection?.state === HubConnectionState.Connected) {
        await this.hubConnection.invoke("SendOffer", receiverId, JSON.stringify(offer));
      }
    }

    async sendAnswer(receiverId: string, answer: RTCSessionDescriptionInit) {
      if (this.hubConnection?.state === HubConnectionState.Connected) {
        await this.hubConnection.invoke("SendAnswer", receiverId, JSON.stringify(answer));
      }
    }

    async sendIceCandidate(receiverId: string, candidate: RTCIceCandidate) {
      if (this.hubConnection?.state === HubConnectionState.Connected) {
        await this.hubConnection.invoke("SendIceCandidate", receiverId, JSON.stringify(candidate));
      }
    }

    async sendEndCall(receiverId: string) {
      if (this.hubConnection?.state === HubConnectionState.Connected) {
        await this.hubConnection.invoke("EndCall", receiverId);
      }
    }
  }