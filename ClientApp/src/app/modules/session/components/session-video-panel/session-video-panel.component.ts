import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  signal,
  ViewChild,
} from '@angular/core';
import { firstValueFrom, Subscription } from 'rxjs';
import { SessionHubService } from '../../../../api/services/session-hub.service';
import { AppointmentClientService } from '../../../../api/services/appointment-client.service';
import { DeepgramTranscriptionService } from '../../../../api/services/deepgram-transcription.service';
import { SessionTranscriptStore } from '../../../../api/services/session-transcript-store.service';

type CallState = 'initializing' | 'waiting' | 'connecting' | 'active' | 'ended';

@Component({
  selector: 'app-session-video-panel',
  standalone: false,
  templateUrl: './session-video-panel.component.html',
  styleUrl: './session-video-panel.component.scss',
})
export class SessionVideoPanelComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) appointmentId!: string;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('localVideo') localVideoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('panelRoot') panelRoot!: ElementRef<HTMLDivElement>;

  callState = signal<CallState>('initializing');
  isAudioMuted = signal(false);
  isVideoMuted = signal(false);
  isFullscreen = signal(false);
  callDuration = signal(0);

  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private subs = new Subscription();
  private remoteUserId: string | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private timerStarted = false;
  private hasJoinedHub = false;
  private transcriptionStarted = false;

  private appointmentService = inject(AppointmentClientService);
  private deepgram = inject(DeepgramTranscriptionService);
  private transcripts = inject(SessionTranscriptStore);

  constructor(private hub: SessionHubService) {}

  ngOnInit() {
    this.createPeer();
    this.wireHubEvents();
  }

  async ngAfterViewInit() {
    // Hard-mute the local video element — both the attribute and the property,
    // since some browsers ignore `muted` once srcObject is assigned dynamically.
    if (this.localVideoEl?.nativeElement) {
      this.localVideoEl.nativeElement.muted = true;
      this.localVideoEl.nativeElement.volume = 0;
    }

    document.addEventListener('fullscreenchange', this.onFullscreenChange);

    await this.startLocalStream();
    this.callState.set('waiting');

    // Announce arrival; receive list of others already inside.
    const others = await this.hub.joinVideo(this.appointmentId);
    this.hasJoinedHub = true;

    if (others.length > 0) {
      // The other side is already here — I'm the second joiner → I send the offer.
      this.remoteUserId = others[0];
      await this.sendOffer();
      this.callState.set('connecting');
    }
    // Otherwise stay in 'waiting' until VideoParticipantJoined fires.
  }

  ngOnDestroy() {
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    this.subs.unsubscribe();
    this.cleanup();
    if (this.hasJoinedHub) {
      this.hub.leaveVideo(this.appointmentId);
    }
  }

  private onFullscreenChange = () => {
    this.isFullscreen.set(!!document.fullscreenElement);
  };

  async toggleFullscreen() {
    const el = this.panelRoot?.nativeElement;
    if (!el) return;

    if (!document.fullscreenElement) {
      try {
        await el.requestFullscreen();
      } catch (e) {
        console.error('Fullscreen error:', e);
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch (e) {
        console.error('Exit fullscreen error:', e);
      }
    }
  }

  // ───────────── WebRTC plumbing ─────────────

  private createPeer() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    this.peerConnection.onicecandidate = (e) => {
      if (e.candidate) this.hub.sendVideoIceCandidate(this.appointmentId, e.candidate);
    };

    this.peerConnection.ontrack = (e) => {
      const stream = e.streams[0];
      if (stream && this.remoteVideoEl?.nativeElement) {
        this.remoteVideoEl.nativeElement.srcObject = stream;
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection!.iceConnectionState;
      if ((state === 'connected' || state === 'completed') && this.callState() !== 'active') {
        this.callState.set('active');
        this.startTimer();
        this.startTranscription();
      } else if (state === 'failed') {
        this.callState.set('ended');
      }
    };
  }

  private wireHubEvents() {
    this.subs.add(
      this.hub.videoParticipantJoined.subscribe(async (userId) => {
        // Someone joined while I'm already here. I do NOT send the offer — they will.
        this.remoteUserId = userId;
        if (this.callState() === 'waiting') {
          this.callState.set('connecting');
        }
      })
    );

    this.subs.add(
      this.hub.videoParticipantLeft.subscribe((userId) => {
        if (userId === this.remoteUserId) {
          this.remoteUserId = null;
          if (this.remoteVideoEl?.nativeElement) {
            this.remoteVideoEl.nativeElement.srcObject = null;
          }
          this.callState.set('waiting');
          this.stopTimer();
        }
      })
    );

    this.subs.add(
      this.hub.videoOfferReceived.subscribe(async ({ senderId, offer }) => {
        if (!this.peerConnection) return;
        this.remoteUserId = senderId;
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        await this.drainPendingIce();

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.hub.sendVideoAnswer(this.appointmentId, answer);
        this.callState.set('connecting');
      })
    );

    this.subs.add(
      this.hub.videoAnswerReceived.subscribe(async ({ answer }) => {
        if (!this.peerConnection) return;
        if (this.peerConnection.signalingState === 'have-local-offer') {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
          await this.drainPendingIce();
        }
      })
    );

    this.subs.add(
      this.hub.videoIceReceived.subscribe(async ({ candidate }) => {
        if (!this.peerConnection) return;
        if (this.peerConnection.remoteDescription?.type) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('ICE error:', e);
          }
        } else {
          this.pendingIce.push(candidate);
        }
      })
    );
  }

  private async drainPendingIce() {
    if (!this.peerConnection) return;
    for (const c of this.pendingIce) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.error('Pending ICE error:', e);
      }
    }
    this.pendingIce = [];
  }

  private async startLocalStream() {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: 'user' },
      });
      if (this.localVideoEl?.nativeElement) {
        this.localVideoEl.nativeElement.srcObject = this.localStream;
      }
      this.localStream.getTracks().forEach((t) => this.peerConnection?.addTrack(t, this.localStream!));
    } catch (err) {
      console.error('Media access error:', err);
    }
  }

  private async sendOffer() {
    if (!this.peerConnection) return;
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.hub.sendVideoOffer(this.appointmentId, offer);
  }

  // ───────────── Transcription ─────────────

  private async startTranscription() {
    if (this.transcriptionStarted) return;
    if (!this.localStream) return;
    this.transcriptionStarted = true;

    try {
      const { token } = await firstValueFrom(
        this.appointmentService.getTranscriptionToken(this.appointmentId)
      );

      this.subs.add(
        this.deepgram.transcript.subscribe(({ text, isFinal }) => {
          const ts = new Date().toISOString();
          this.transcripts.push('local', text, isFinal, ts);
          this.hub.sendTranscript(this.appointmentId, text, isFinal);
        })
      );

      this.subs.add(
        this.deepgram.error.subscribe((err) => console.warn('[Transcription]', err))
      );

      await this.deepgram.start(this.localStream, token);
    } catch (err) {
      console.error('[Transcription] failed to start:', err);
      this.transcriptionStarted = false;
    }
  }

  // ───────────── UI controls ─────────────

  toggleAudio() {
    const next = !this.isAudioMuted();
    this.isAudioMuted.set(next);
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !next));
  }

  toggleVideo() {
    const next = !this.isVideoMuted();
    this.isVideoMuted.set(next);
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = !next));
  }

  endCall() {
    this.closed.emit();
  }

  private startTimer() {
    if (this.timerStarted) return;
    this.timerStarted = true;
    this.timer = setInterval(() => this.callDuration.update((d) => d + 1), 1000);
  }

  private stopTimer() {
    clearInterval(this.timer);
    this.timer = undefined;
    this.timerStarted = false;
    this.callDuration.set(0);
  }

  private cleanup() {
    clearInterval(this.timer);
    this.deepgram.stop();
    this.transcriptionStarted = false;
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.peerConnection?.close();
    this.peerConnection = null;
  }

  get formattedDuration(): string {
    const d = this.callDuration();
    const m = Math.floor(d / 60).toString().padStart(2, '0');
    const s = (d % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}
