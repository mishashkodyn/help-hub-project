import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface DeepgramTranscriptChunk {
  text: string;
  isFinal: boolean;
}

/**
 * Streams audio from a given MediaStream to Deepgram over a direct WebSocket
 * and emits transcript chunks. Each instance manages exactly one active stream.
 */
@Injectable({ providedIn: 'root' })
export class DeepgramTranscriptionService {
  private static readonly DEEPGRAM_URL =
    'wss://api.deepgram.com/v1/listen' +
    '?model=nova-3' +
    '&language=multi' +
    '&interim_results=true' +
    '&smart_format=true' +
    '&punctuate=true' +
    '&endpointing=300';

  private ws: WebSocket | null = null;
  private recorder: MediaRecorder | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  readonly transcript = new Subject<DeepgramTranscriptChunk>();
  readonly error = new Subject<string>();

  isRunning(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Opens the Deepgram WebSocket and starts streaming the audio tracks from `stream`.
   * `token` should be a short-lived Deepgram API key issued by the backend.
   */
  start(stream: MediaStream, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stop();

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        reject(new Error('No audio track on the provided stream.'));
        return;
      }

      const audioOnly = new MediaStream(audioTracks);
      const mimeType = this.pickMimeType();
      if (!mimeType) {
        reject(new Error('No supported audio MIME type for MediaRecorder.'));
        return;
      }

      let ws: WebSocket;
      try {
        ws = new WebSocket(DeepgramTranscriptionService.DEEPGRAM_URL, ['token', token]);
      } catch (err) {
        reject(err);
        return;
      }
      this.ws = ws;

      ws.onopen = () => {
        try {
          const recorder = new MediaRecorder(audioOnly, { mimeType });
          this.recorder = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
              ws.send(e.data);
            }
          };

          recorder.onerror = (e) => {
            console.error('[Deepgram] MediaRecorder error:', e);
            this.error.next('MediaRecorder error');
          };

          // 250 ms chunks give a good latency/throughput balance.
          recorder.start(250);

          // Send a keep-alive every 5 s to prevent idle-timeout disconnects from Deepgram.
          this.keepAliveTimer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'KeepAlive' }));
            }
          }, 5000);

          resolve();
        } catch (err) {
          console.error('[Deepgram] failed to start recorder:', err);
          this.stop();
          reject(err);
        }
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'Results') {
            const text: string = msg.channel?.alternatives?.[0]?.transcript ?? '';
            if (text && text.trim().length > 0) {
              this.transcript.next({ text, isFinal: !!msg.is_final });
            }
          }
        } catch (err) {
          console.error('[Deepgram] failed to parse message:', err);
        }
      };

      ws.onerror = (e) => {
        console.error('[Deepgram] WebSocket error:', e);
        this.error.next('Deepgram WebSocket error');
      };

      ws.onclose = (e) => {
        console.log('[Deepgram] WebSocket closed', e.code, e.reason);
      };
    });
  }

  stop(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }

    if (this.recorder) {
      try {
        if (this.recorder.state !== 'inactive') this.recorder.stop();
      } catch (err) {
        console.warn('[Deepgram] recorder stop failed:', err);
      }
      this.recorder = null;
    }

    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'CloseStream' }));
        }
      } catch {
        /* socket may already be closing */
      }
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
  }

  private pickMimeType(): string | null {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
    ];
    for (const m of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
    }
    return null;
  }
}
