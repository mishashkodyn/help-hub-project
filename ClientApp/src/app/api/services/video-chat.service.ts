import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { Subject, Subscription } from 'rxjs';
import { VideoChatComponent } from '../../modules/chat/components/video-chat/video-chat.component';
import { MatDialog } from '@angular/material/dialog';

@Injectable({ providedIn: 'root' })
export class VideoChatService {
  private hubUrl = `${environment.hubUrl}/video`;
  private hubConnection: HubConnection | null = null;

  readonly offerReceived = new Subject<{ senderId: string; offer: RTCSessionDescriptionInit }>();
  readonly answerReceived = new Subject<{ senderId: string; answer: RTCSessionDescriptionInit }>();
  readonly callEnded = new Subject<void>();

  isCallActive = false;
  incomingCall = false;
  remoteUserId: string | null = null;
  isConnected = signal<boolean>(false);

  // Single subscription guard — prevents duplicate offer handlers on reconnect
  private _offerSub: Subscription | null = null;

  // ICE candidates received before the callee component opens are buffered here.
  // Once the component registers a handler, the buffer is drained and future
  // candidates are delivered directly via the callback.
  private _candidateHandler: ((c: RTCIceCandidateInit) => void) | null = null;
  private _candidateBuffer: RTCIceCandidateInit[] = [];

  private readonly matDialog = inject(MatDialog);

  async startConnection() {
    if (
      this.hubConnection?.state === HubConnectionState.Connected ||
      this.hubConnection?.state === HubConnectionState.Connecting
    ) return;

    this._candidateBuffer = [];

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(this.hubUrl, { accessTokenFactory: () => localStorage.getItem('token')! })
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('ReceiveOffer', (senderId: string, offer: string) => {
      // Start fresh candidate buffer for each new call
      this._candidateBuffer = [];
      const parsed: RTCSessionDescriptionInit = typeof offer === 'string' ? JSON.parse(offer) : offer;
      this.offerReceived.next({ senderId, offer: parsed });
    });

    this.hubConnection.on('ReceiveAnswer', (senderId: string, answer: string) => {
      const parsed: RTCSessionDescriptionInit = typeof answer === 'string' ? JSON.parse(answer) : answer;
      this.answerReceived.next({ senderId, answer: parsed });
    });

    this.hubConnection.on('ReceiveIceCandidate', (_senderId: string, candidate: string) => {
      const parsed: RTCIceCandidateInit = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
      if (this._candidateHandler) {
        this._candidateHandler(parsed);
      } else {
        this._candidateBuffer.push(parsed);
      }
    });

    this.hubConnection.on('CallEnded', () => {
      this.callEnded.next();
    });

    this.hubConnection
      .start()
      .then(() => {
        this.isConnected.set(true);
        this.setupOfferHandler();
      })
      .catch((err) => console.error('Video Chat Hub Error:', err));
  }

  private setupOfferHandler() {
    if (this._offerSub) return;

    this._offerSub = this.offerReceived.subscribe((data) => {
      if (!data?.senderId) return;
      // Don't open a second dialog if one is already open
      if (this.matDialog.openDialogs.length > 0) return;

      this.matDialog.open(VideoChatComponent, {
        maxWidth: '100vw',
        maxHeight: '100vh',
        panelClass: 'video-chat-dialog',
        disableClose: true,
        data: { isCaller: false, offer: data.offer, remoteUserId: data.senderId },
      });
    });
  }

  /**
   * Called by VideoChatComponent on init.
   * Drains any buffered candidates into the handler immediately,
   * then routes all subsequent candidates to it directly.
   */
  registerCandidateHandler(handler: (c: RTCIceCandidateInit) => void) {
    this._candidateHandler = handler;
    const buffered = this._candidateBuffer.splice(0);
    buffered.forEach(handler);
  }

  unregisterCandidateHandler() {
    this._candidateHandler = null;
  }

  stopConnection() {
    this._offerSub?.unsubscribe();
    this._offerSub = null;
    this._candidateHandler = null;
    this._candidateBuffer = [];
    const conn = this.hubConnection;
    if (!conn) return;
    this.hubConnection = null;
    if (conn.state !== HubConnectionState.Disconnected) {
      conn.stop().finally(() => this.isConnected.set(false));
    } else {
      this.isConnected.set(false);
    }
  }

  async sendOffer(receiverId: string, offer: RTCSessionDescriptionInit) {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      await this.hubConnection.invoke('SendOffer', receiverId, JSON.stringify(offer));
    }
  }

  async sendAnswer(receiverId: string, answer: RTCSessionDescriptionInit) {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      await this.hubConnection.invoke('SendAnswer', receiverId, JSON.stringify(answer));
    }
  }

  async sendIceCandidate(receiverId: string, candidate: RTCIceCandidate) {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      await this.hubConnection.invoke('SendIceCandidate', receiverId, JSON.stringify(candidate));
    }
  }

  async sendEndCall(receiverId: string) {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      await this.hubConnection.invoke('EndCall', receiverId);
    }
  }
}
