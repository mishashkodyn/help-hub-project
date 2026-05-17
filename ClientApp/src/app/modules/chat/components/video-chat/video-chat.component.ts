import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { VideoChatService } from '../../../../api/services/video-chat.service';
import { ChatService } from '../../../../api/services/chat.service';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';

type CallState = 'initializing' | 'calling' | 'incoming' | 'connecting' | 'active';

@Component({
  selector: 'app-video-chat',
  standalone: true,
  imports: [MatIconModule, CommonModule],
  templateUrl: './video-chat.component.html',
  styleUrl: './video-chat.component.scss',
})
export class VideoChatComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;

  private peerConnection!: RTCPeerConnection;
  private localStream: MediaStream | null = null;
  private subscriptions = new Subscription();
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private callTimer?: ReturnType<typeof setInterval>;
  private timerStarted = false;
  private acceptInProgress = false;

  protected svc = inject(VideoChatService);
  protected dialogRef = inject(MatDialogRef<VideoChatComponent>);
  private chatService = inject(ChatService);

  protected callState = signal<CallState>('initializing');
  protected callDuration = signal(0);
  protected isFrontCamera = true;
  protected hasMultipleCameras = false;
  protected isAudioMuted = false;
  protected isVideoMuted = false;

  private videoDevices: MediaDeviceInfo[] = [];
  private currentCameraIndex = 0;

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: {
      isCaller: boolean;
      offer?: RTCSessionDescriptionInit;
      remoteUserId: string;
    },
  ) {}

  ngOnInit() {
    if (!this.data?.remoteUserId) {
      this.dialogRef.close();
      return;
    }

    this.svc.remoteUserId = this.data.remoteUserId;
    this.createPeerConnection();
    this.setupSignalListeners();
    this.svc.registerCandidateHandler((c) => this.addIceCandidate(c));

    // Set incoming state SYNCHRONOUSLY so the accept/decline buttons appear
    // immediately — before any async operations in ngAfterViewInit.
    if (!this.data.isCaller && this.data.offer) {
      this.callState.set('incoming');
    }
  }

  async ngAfterViewInit() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.videoDevices = devices.filter((d) => d.kind === 'videoinput');
      this.hasMultipleCameras = this.videoDevices.length > 1;
    } catch {}

    if (this.data.isCaller) {
      await this.startLocalStream();
      this.callState.set('calling');
      await this.startCall();
    } else if (this.data.offer) {
      // Start camera in background for the preview/toggles on the incoming screen.
      // Non-blocking — do not close dialog on failure here.
      this.acquirePreviewStream();

      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(this.data.offer),
      );
      await this.processPendingCandidates();
    }
  }

  ngOnDestroy() {
    this.endCallInternal();
    this.subscriptions.unsubscribe();
    clearInterval(this.callTimer);
  }

  private createPeerConnection() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.svc.remoteUserId) {
        this.svc.sendIceCandidate(this.svc.remoteUserId, event.candidate);
      }
    };

    this.peerConnection.ontrack = (event) => {
      if (event.streams[0] && this.remoteVideo?.nativeElement) {
        this.remoteVideo.nativeElement.srcObject = event.streams[0];
        // State transition happens in oniceconnectionstatechange, not here.
        // ontrack fires at setRemoteDescription time (before ICE), so acting
        // on it would bypass the callee's accept/decline screen.
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      if ((state === 'connected' || state === 'completed') && this.callState() !== 'active') {
        this.callState.set('active');
        this.startTimer();
      } else if (state === 'disconnected' || state === 'failed') {
        this.closeDialogAndCleanup();
      }
    };
  }

  /** Full stream acquisition — closes dialog on failure (used for caller and accept). */
  private async startLocalStream(deviceId?: string) {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.closeDialogAndCleanup();
      return;
    }

    this.localStream?.getTracks().forEach((t) => t.stop());

    const constraints: MediaStreamConstraints = {
      audio: true,
      video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' },
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.attachLocalStreamToVideo();
      this.addTracksToPC();
      this.localStream.getAudioTracks().forEach((t) => (t.enabled = !this.isAudioMuted));
      this.localStream.getVideoTracks().forEach((t) => (t.enabled = !this.isVideoMuted));
    } catch (err) {
      console.error('Media access error:', err);
      this.closeDialogAndCleanup();
    }
  }

  /** Silent stream acquisition for the incoming preview — never closes dialog. */
  private async acquirePreviewStream() {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: 'user' },
      });
      this.attachLocalStreamToVideo();
      // Apply any mute states the user toggled while the stream was loading.
      this.localStream.getAudioTracks().forEach((t) => (t.enabled = !this.isAudioMuted));
      this.localStream.getVideoTracks().forEach((t) => (t.enabled = !this.isVideoMuted));
      // Do NOT add tracks to PC here — tracks are added only when accepting.
    } catch {
      // Camera denied or unavailable; user can still accept (audio-only or no media).
    }
  }

  private attachLocalStreamToVideo() {
    if (this.localVideo?.nativeElement && this.localStream) {
      this.localVideo.nativeElement.srcObject = this.localStream;
    }
  }

  private addTracksToPC() {
    if (!this.localStream || this.peerConnection.signalingState === 'closed') return;
    const senders = this.peerConnection.getSenders();
    for (const track of this.localStream.getTracks()) {
      const sender = senders.find((s) => s.track?.kind === track.kind);
      if (sender) {
        sender.replaceTrack(track);
      } else {
        this.peerConnection.addTrack(track, this.localStream);
      }
    }
  }

  private setupSignalListeners() {
    this.subscriptions.add(
      this.svc.answerReceived.subscribe(async (data) => {
        if (data && this.peerConnection.signalingState === 'have-local-offer') {
          await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.answer),
          );
          await this.processPendingCandidates();
        }
      }),
    );

    this.subscriptions.add(
      this.svc.callEnded.subscribe(() => {
        // Remote side ended or declined — only the caller saves the record
        if (this.data.isCaller) {
          this.persistCallRecord();
        }
        this.closeDialogAndCleanup();
      }),
    );
  }

  private async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (this.peerConnection.remoteDescription?.type) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('ICE candidate error:', e);
      }
    } else {
      this.pendingIceCandidates.push(candidate);
    }
  }

  private async processPendingCandidates() {
    for (const candidate of this.pendingIceCandidates) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Pending ICE error:', e);
      }
    }
    this.pendingIceCandidates = [];
  }

  private async startCall() {
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    if (this.svc.remoteUserId) {
      await this.svc.sendOffer(this.svc.remoteUserId, offer);
    }
  }

  async acceptCall() {
    if (this.acceptInProgress) return;
    this.acceptInProgress = true;

    // If the background camera acquisition is still in progress or was denied,
    // try again now (blocking). Otherwise use the already-open stream.
    if (!this.localStream) {
      this.callState.set('initializing');
      await this.startLocalStream();
      if (!this.localStream) return; // camera denied, dialog already closed
    } else {
      // Stream is ready from preview — just wire the tracks into the PC.
      this.addTracksToPC();
    }

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    if (this.svc.remoteUserId) {
      await this.svc.sendAnswer(this.svc.remoteUserId, answer);
    }
    this.callState.set('connecting');
    // callState transitions to 'active' when iceConnectionState reaches 'connected'.
  }

  declineCall() {
    if (this.svc.remoteUserId) this.svc.sendEndCall(this.svc.remoteUserId);
    this.closeDialogAndCleanup();
  }

  endCall() {
    if (this.data.isCaller) this.persistCallRecord();
    if (this.svc.remoteUserId) this.svc.sendEndCall(this.svc.remoteUserId);
    this.closeDialogAndCleanup();
  }

  private persistCallRecord() {
    const duration = this.callState() === 'active' ? this.callDuration() : null;
    this.chatService.saveCallRecord(this.data.remoteUserId, duration);
  }

  toggleAudio() {
    this.isAudioMuted = !this.isAudioMuted;
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !this.isAudioMuted));
  }

  toggleVideo() {
    this.isVideoMuted = !this.isVideoMuted;
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = !this.isVideoMuted));
  }

  async switchCamera() {
    if (!this.hasMultipleCameras) return;
    this.currentCameraIndex = (this.currentCameraIndex + 1) % this.videoDevices.length;
    const device = this.videoDevices[this.currentCameraIndex];
    this.isFrontCamera =
      device.label.toLowerCase().includes('front') || this.currentCameraIndex === 0;
    await this.startLocalStream(device.deviceId);
  }

  private startTimer() {
    if (this.timerStarted) return;
    this.timerStarted = true;
    this.callTimer = setInterval(() => this.callDuration.update((d) => d + 1), 1000);
  }

  get formattedDuration(): string {
    const d = this.callDuration();
    const m = Math.floor(d / 60).toString().padStart(2, '0');
    const s = (d % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  private closeDialogAndCleanup() {
    this.endCallInternal();
    this.dialogRef.close();
  }

  private endCallInternal() {
    clearInterval(this.callTimer);
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    if (this.peerConnection) this.peerConnection.close();
    this.svc.unregisterCandidateHandler();
    this.svc.isCallActive = false;
    this.svc.incomingCall = false;
    this.svc.remoteUserId = null;
  }
}
