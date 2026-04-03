import {
  Component,
  ElementRef,
  Inject,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { VideoChatService } from '../../../../api/services/video-chat.service';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-video-chat',
  standalone: true,
  imports: [MatIconModule, CommonModule],
  templateUrl: './video-chat.component.html',
  styleUrl: './video-chat.component.scss',
})
export class VideoChatComponent implements OnInit, OnDestroy {
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;

  private peerConnection!: RTCPeerConnection;
  private localStream: MediaStream | null = null;
  private subscriptions: Subscription = new Subscription();

  private pendingIceCandidates: RTCIceCandidateInit[] = [];

  protected signalRService = inject(VideoChatService);
  protected dialogRef = inject(MatDialogRef<VideoChatComponent>);

  protected isFrontCamera: boolean = true;
  protected hasMultipleCameras: boolean = false;
  private videoDevices: MediaDeviceInfo[] = [];
  private currentCameraIndex: number = 0;

  protected isAudioMuted: boolean = false;
  protected isVideoMuted: boolean = false;

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: {
      isCaller: boolean;
      offer?: RTCSessionDescriptionInit;
      remoteUserId: string;
    },
  ) {}

  async ngOnInit() {
    if (!this.data || !this.data.remoteUserId) {
      this.dialogRef.close();
      return;
    }

    this.signalRService.remoteUserId = this.data.remoteUserId;
    await this.checkCameras();
    this.createPeerConnection();
    await this.startLocalStream();
    this.setupSignalListeners();

    if (!this.data.isCaller && this.data.offer) {
      await this.handleOffer(this.data.offer);
    } else if (this.data.isCaller) {
      this.startCall();
    }
  }

  ngOnDestroy(): void {
    this.endCallInternal();
    this.subscriptions.unsubscribe();
  }

  toggleAudio() {
    if (this.localStream) {
      this.isAudioMuted = !this.isAudioMuted;
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isAudioMuted;
      });
    }
  }

  toggleVideo() {
    if (this.localStream) {
      this.isVideoMuted = !this.isVideoMuted;
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = !this.isVideoMuted;
      });
    }
  }

  async checkCameras() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.videoDevices = devices.filter(
        (device) => device.kind === 'videoinput',
      );
      this.hasMultipleCameras = this.videoDevices.length > 1;
    } catch (e) {
      console.error('Camera check failed', e);
    }
  }

  async switchCamera() {
    if (!this.hasMultipleCameras) return;

    this.currentCameraIndex =
      (this.currentCameraIndex + 1) % this.videoDevices.length;
    const newDevice = this.videoDevices[this.currentCameraIndex];

    this.isFrontCamera =
      newDevice.label.toLowerCase().includes('front') || !this.isFrontCamera;

    await this.startLocalStream(newDevice.deviceId);
  }

  createPeerConnection() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.signalRService.remoteUserId) {
        this.signalRService.sendIceCandidate(
          this.signalRService.remoteUserId,
          event.candidate,
        );
      }
    };

    this.peerConnection.ontrack = (event) => {
      if (this.remoteVideo && event.streams[0]) {
        this.remoteVideo.nativeElement.srcObject = event.streams[0];
      }
    };
  }

  async startLocalStream(deviceId?: string) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('Media devices are not available. HTTPS is required.');
      this.endCallInternal();
      this.dialogRef.close();
      return;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }

    const constraints: MediaStreamConstraints = {
      audio: true,
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: 'user' },
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (this.localVideo) {
        this.localVideo.nativeElement.srcObject = this.localStream;
      }

      if (this.peerConnection.signalingState !== 'closed') {
        const videoTrack = this.localStream.getVideoTracks()[0];
        const sender = this.peerConnection
          .getSenders()
          .find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        } else {
          this.localStream.getTracks().forEach((track) => {
            this.peerConnection.addTrack(track, this.localStream!);
          });
        }
      }
    } catch (err) {
      console.error('Error accessing media devices.', err);
    }
  }

  setupSignalListeners() {
    this.subscriptions.add(
      this.signalRService.answerReceived.subscribe(async (data) => {
        if (!data || !data.answer) return;

        if (this.peerConnection.signalingState === 'have-local-offer') {
          try {
            await this.peerConnection.setRemoteDescription(
              new RTCSessionDescription(data.answer),
            );
            await this.processPendingCandidates();
          } catch (err) {
            console.error('Error setting remote answer:', err);
          }
        } else {
          console.warn(
            `Received answer in unexpected state: ${this.peerConnection.signalingState}. Ignoring.`,
          );
        }
      }),
    );

    this.subscriptions.add(
      this.signalRService.iceCandidateReceived.subscribe(async (data) => {
        if (data?.candidate) {
          await this.addIceCandidate(data.candidate);
        }
      }),
    );

    this.subscriptions.add(
      this.signalRService.callEnded.subscribe(() => {
        this.closeDialogAndCleanup();
      }),
    );
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (
      this.peerConnection.remoteDescription &&
      this.peerConnection.remoteDescription.type
    ) {
      try {
        await this.peerConnection.addIceCandidate(
          new RTCIceCandidate(candidate),
        );
      } catch (e) {
        console.error('Error adding ICE:', e);
      }
    } else {
      this.pendingIceCandidates.push(candidate);
    }
  }

  async processPendingCandidates() {
    for (const candidate of this.pendingIceCandidates) {
      try {
        await this.peerConnection.addIceCandidate(
          new RTCIceCandidate(candidate),
        );
      } catch (e) {
        console.error('Error processing pending ICE:', e);
      }
    }
    this.pendingIceCandidates = [];
  }

  async startCall() {
    this.signalRService.isCallActive = true;
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    if (this.signalRService.remoteUserId) {
      this.signalRService.sendOffer(this.signalRService.remoteUserId, offer);
    }
  }

  async handleOffer(offer: RTCSessionDescriptionInit) {
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(offer),
    );
    this.processPendingCandidates();

    this.signalRService.incomingCall = true;
  }

  async acceptCall() {
    this.signalRService.incomingCall = false;
    this.signalRService.isCallActive = true;

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    if (this.signalRService.remoteUserId) {
      this.signalRService.sendAnswer(this.signalRService.remoteUserId, answer);
    }
  }

  declineCall() {
    if (this.signalRService.remoteUserId) {
      this.signalRService.sendEndCall(this.signalRService.remoteUserId);
    }
    this.closeDialogAndCleanup();
  }

  endCall() {
    if (this.signalRService.remoteUserId) {
      this.signalRService.sendEndCall(this.signalRService.remoteUserId);
    }
    this.closeDialogAndCleanup();
  }

  private closeDialogAndCleanup() {
    this.endCallInternal();
    this.dialogRef.close();
  }

  private endCallInternal() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.signalRService.isCallActive = false;
    this.signalRService.incomingCall = false;
    this.signalRService.remoteUserId = null;
  }
}
