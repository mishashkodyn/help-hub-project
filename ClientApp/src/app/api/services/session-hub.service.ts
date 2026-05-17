import { Injectable, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SessionMessageDto } from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class SessionHubService {
  private hubUrl = `${environment.hubUrl}/session`;
  private hubConnection: HubConnection | null = null;

  readonly messageReceived = new Subject<SessionMessageDto>();
  readonly historyReceived = new Subject<SessionMessageDto[]>();

  // Video events
  readonly videoParticipantJoined = new Subject<string>();
  readonly videoParticipantLeft = new Subject<string>();
  readonly videoOfferReceived = new Subject<{ senderId: string; offer: RTCSessionDescriptionInit }>();
  readonly videoAnswerReceived = new Subject<{ senderId: string; answer: RTCSessionDescriptionInit }>();
  readonly videoIceReceived = new Subject<{ senderId: string; candidate: RTCIceCandidateInit }>();

  // Transcription events (transcripts produced by the OTHER participant)
  readonly transcriptReceived = new Subject<{ senderId: string; text: string; isFinal: boolean; timestamp: string }>();

  isConnected = signal(false);

  async startConnection(appointmentId: string) {
    if (
      this.hubConnection?.state === HubConnectionState.Connected ||
      this.hubConnection?.state === HubConnectionState.Connecting
    ) return;

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(`${this.hubUrl}?appointmentId=${appointmentId}`, {
        accessTokenFactory: () => localStorage.getItem('token')!
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('ReceiveMessage', (msg: SessionMessageDto) => {
      console.log('[SessionHub] ReceiveMessage:', msg);
      this.messageReceived.next(msg);
    });

    this.hubConnection.on('ReceiveHistory', (msgs: SessionMessageDto[]) => {
      console.log('[SessionHub] ReceiveHistory: ' + msgs.length + ' messages');
      this.historyReceived.next(msgs);
    });

    this.hubConnection.on('VideoParticipantJoined', (userId: string) => {
      this.videoParticipantJoined.next(userId);
    });

    this.hubConnection.on('VideoParticipantLeft', (userId: string) => {
      this.videoParticipantLeft.next(userId);
    });

    this.hubConnection.on('ReceiveVideoOffer', (senderId: string, payload: string) => {
      const offer: RTCSessionDescriptionInit = typeof payload === 'string' ? JSON.parse(payload) : payload;
      this.videoOfferReceived.next({ senderId, offer });
    });

    this.hubConnection.on('ReceiveVideoAnswer', (senderId: string, payload: string) => {
      const answer: RTCSessionDescriptionInit = typeof payload === 'string' ? JSON.parse(payload) : payload;
      this.videoAnswerReceived.next({ senderId, answer });
    });

    this.hubConnection.on('ReceiveVideoIceCandidate', (senderId: string, payload: string) => {
      const candidate: RTCIceCandidateInit = typeof payload === 'string' ? JSON.parse(payload) : payload;
      this.videoIceReceived.next({ senderId, candidate });
    });

    this.hubConnection.on('ReceiveTranscript', (senderId: string, text: string, isFinal: boolean, timestamp: string) => {
      this.transcriptReceived.next({ senderId, text, isFinal, timestamp });
    });

    await this.hubConnection
      .start()
      .then(() => {
        console.log('[SessionHub] Connected for appointment', appointmentId);
        this.isConnected.set(true);
        this.loadHistory(appointmentId);
      })
      .catch(err => console.error('[SessionHub] Connection error:', err));
  }

  private async loadHistory(appointmentId: string) {
    if (this.hubConnection?.state !== HubConnectionState.Connected) return;
    try {
      await this.hubConnection.invoke('LoadHistory', appointmentId);
    } catch (err) {
      console.error('[SessionHub] LoadHistory failed:', err);
    }
  }

  async sendMessage(appointmentId: string, content: string) {
    if (this.hubConnection?.state !== HubConnectionState.Connected) {
      console.warn('[SessionHub] sendMessage skipped — not connected. State:', this.hubConnection?.state);
      return;
    }
    try {
      await this.hubConnection.invoke('SendMessage', appointmentId, content);
    } catch (err) {
      console.error('[SessionHub] SendMessage failed:', err);
    }
  }

  /** Joins the video room. Returns userIds of OTHER participants already inside. */
  async joinVideo(appointmentId: string): Promise<string[]> {
    if (this.hubConnection?.state !== HubConnectionState.Connected) return [];
    return await this.hubConnection.invoke<string[]>('JoinVideo', appointmentId) ?? [];
  }

  leaveVideo(appointmentId: string) {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      this.hubConnection.invoke('LeaveVideo', appointmentId);
    }
  }

  sendVideoOffer(appointmentId: string, offer: RTCSessionDescriptionInit) {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      this.hubConnection.invoke('SendVideoOffer', appointmentId, JSON.stringify(offer));
    }
  }

  sendVideoAnswer(appointmentId: string, answer: RTCSessionDescriptionInit) {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      this.hubConnection.invoke('SendVideoAnswer', appointmentId, JSON.stringify(answer));
    }
  }

  sendVideoIceCandidate(appointmentId: string, candidate: RTCIceCandidate) {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      this.hubConnection.invoke('SendVideoIceCandidate', appointmentId, JSON.stringify(candidate));
    }
  }

  sendTranscript(appointmentId: string, text: string, isFinal: boolean) {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      this.hubConnection.invoke('SendTranscript', appointmentId, text, isFinal)
        .catch(err => console.error('[SessionHub] SendTranscript failed:', err));
    }
  }

  stopConnection() {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      this.hubConnection.stop().then(() => this.isConnected.set(false));
    }
    this.hubConnection = null;
  }
}
