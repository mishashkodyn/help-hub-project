import { Injectable, computed, signal } from '@angular/core';

export type TranscriptSpeaker = 'local' | string; // 'local' for the current user, sender Guid otherwise

export interface FinalTranscript {
  id: string;
  speaker: TranscriptSpeaker;
  text: string;
  timestamp: string;
}

/**
 * In-memory store for the transcripts of the currently open session.
 * Lives for the lifetime of the user inside a session room — cleared on leave.
 *
 * Speaker is recorded as either the literal 'local' (for the current user's own
 * transcripts produced by their browser's Deepgram stream) or as the senderId
 * (Guid) of the other participant relayed via SignalR. Resolving Guid → display
 * name is done by consumers that have access to the session info DTO.
 */
@Injectable({ providedIn: 'root' })
export class SessionTranscriptStore {
  private _finals = signal<FinalTranscript[]>([]);
  private _interims = signal<Record<TranscriptSpeaker, string>>({});

  readonly finals = this._finals.asReadonly();
  readonly interims = this._interims.asReadonly();

  /** Latest interim or last-final text per speaker — used to drive caption overlays. */
  readonly latestPerSpeaker = computed(() => {
    const result: Record<TranscriptSpeaker, string> = {};
    for (const f of this._finals()) {
      result[f.speaker] = f.text;
    }
    for (const [speaker, text] of Object.entries(this._interims())) {
      if (text) result[speaker] = text;
    }
    return result;
  });

  push(speaker: TranscriptSpeaker, text: string, isFinal: boolean, timestamp: string): void {
    const clean = text.trim();
    if (!clean) return;

    if (isFinal) {
      this._finals.update(arr => [
        ...arr,
        { id: this.makeId(), speaker, text: clean, timestamp },
      ]);
      this._interims.update(map => {
        if (!(speaker in map)) return map;
        const next = { ...map };
        delete next[speaker];
        return next;
      });
    } else {
      this._interims.update(map => ({ ...map, [speaker]: clean }));
    }
  }

  clear(): void {
    this._finals.set([]);
    this._interims.set({});
  }

  private makeId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
