import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

/** A single muscle group the practice walks through, feet to face. */
interface MuscleGroup {
  /** Suffix into `selfHelp.pmr.groups.*` and the SVG part class. */
  key:
    | 'feet'
    | 'legs'
    | 'hips'
    | 'stomach'
    | 'hands'
    | 'arms'
    | 'shoulders'
    | 'face';
}

/** Each group is tensed, then released — two phases per group. */
type Phase = 'tense' | 'release';

/** Player lifecycle. `prepare` is the short settle-in before the first group. */
type PlayerState =
  | 'idle'
  | 'prepare'
  | 'tensing'
  | 'releasing'
  | 'paused'
  | 'done';

/**
 * Progressive muscle relaxation.
 *
 * Attention is walked from the feet up to the face, one muscle group at a time.
 * For each group the user first *tenses* the muscles for a few seconds, then
 * *releases* and rests for longer — learning the contrast between tension and
 * ease. A body silhouette lights the group in focus (warm while tensing, calm
 * green while releasing) and a per-phase countdown paces the cycle. Timing is
 * driven by `requestAnimationFrame` off a `performance.now()` clock so the
 * countdown stays accurate even if a frame is dropped. The user can step
 * between groups by hand, pause/resume, and pick how long to hold the tension.
 */
@Component({
  selector: 'app-progressive-muscle',
  standalone: false,
  templateUrl: './progressive-muscle.component.html',
  styleUrl: './progressive-muscle.component.scss',
})
export class ProgressiveMuscleComponent implements OnDestroy {
  readonly groups: MuscleGroup[] = [
    { key: 'feet' },
    { key: 'legs' },
    { key: 'hips' },
    { key: 'stomach' },
    { key: 'hands' },
    { key: 'arms' },
    { key: 'shoulders' },
    { key: 'face' },
  ];

  /** How long to hold the tension, in seconds — the user can pick. */
  readonly tenseOptions = [4, 5, 7];
  tenseSeconds = 5;
  /** Resting/release time is fixed and longer than the tension. */
  private readonly releaseSeconds = 12;

  /** Seconds of settle-in before the first group. */
  private readonly prepareSeconds = 3;

  state: PlayerState = 'idle';
  /** Index into `groups` of the muscle group in focus. */
  index = 0;
  phase: Phase = 'tense';
  /** Whole-second countdown left in the current phase. */
  countdown = 0;
  prepareCountdown = this.prepareSeconds;
  soundOn = false;

  private rafId = 0;
  private phaseStart = 0;
  private prepareStart = 0;
  /** Seconds elapsed in the current phase — drives the ring + progress bar. */
  phaseElapsed = 0;
  private pausedPhaseElapsed = 0;
  private audioCtx?: AudioContext;

  constructor(private router: Router) {}

  // ── Derived view state ──────────────────────────────────────────────────
  get current(): MuscleGroup {
    return this.groups[this.index];
  }

  get isRunning(): boolean {
    return this.state === 'tensing' || this.state === 'releasing';
  }

  get isActiveSession(): boolean {
    return this.isRunning || this.state === 'paused';
  }

  get isTensing(): boolean {
    return this.phase === 'tense';
  }

  get isFirst(): boolean {
    return this.index === 0;
  }

  get isLast(): boolean {
    return this.index === this.groups.length - 1;
  }

  /** Length of the phase currently running. */
  get phaseSeconds(): number {
    return this.phase === 'tense' ? this.tenseSeconds : this.releaseSeconds;
  }

  private get groupSeconds(): number {
    return this.tenseSeconds + this.releaseSeconds;
  }

  private get totalSeconds(): number {
    return this.groups.length * this.groupSeconds;
  }

  /** Seconds elapsed across the whole session. */
  private get elapsedTotal(): number {
    const before = this.index * this.groupSeconds;
    const within =
      (this.phase === 'release' ? this.tenseSeconds : 0) + this.phaseElapsed;
    return before + within;
  }

  /** 0..1 fraction of the current phase completed — drives the timer ring. */
  get phaseProgress(): number {
    return Math.min(this.phaseElapsed / this.phaseSeconds, 1);
  }

  /** 0..1 fraction of the whole session completed. */
  get progress(): number {
    return Math.min(this.elapsedTotal / this.totalSeconds, 1);
  }

  /** Time left across the whole session as m:ss. */
  get timeRemaining(): string {
    const left = Math.max(this.totalSeconds - this.elapsedTotal, 0);
    const whole = Math.ceil(left);
    const m = Math.floor(whole / 60);
    const s = whole % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── Controls ────────────────────────────────────────────────────────────
  toggle(): void {
    switch (this.state) {
      case 'tensing':
      case 'releasing':
        this.pause();
        break;
      case 'paused':
        this.resume();
        break;
      default:
        this.startPrepare();
    }
  }

  reset(): void {
    cancelAnimationFrame(this.rafId);
    this.state = 'idle';
    this.index = 0;
    this.phase = 'tense';
    this.countdown = 0;
    this.phaseElapsed = 0;
    this.prepareCountdown = this.prepareSeconds;
  }

  /** Hold length can only change between sessions, to keep the pacing steady. */
  setTense(seconds: number): void {
    if (this.isActiveSession || this.tenseSeconds === seconds) return;
    this.tenseSeconds = seconds;
  }

  /** Skip to the next group's tension phase by hand; keeps the session going. */
  next(): void {
    if (this.isLast) {
      this.finish();
      return;
    }
    this.jumpTo(this.index + 1);
  }

  prev(): void {
    if (this.isFirst) return;
    this.jumpTo(this.index - 1);
  }

  goTo(i: number): void {
    if (!this.isActiveSession) return;
    this.jumpTo(i);
  }

  toggleSound(): void {
    this.soundOn = !this.soundOn;
    if (this.soundOn && !this.audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (Ctx) this.audioCtx = new Ctx();
    }
    // Browsers start the context suspended until a user gesture.
    this.audioCtx?.resume();
  }

  goBack(): void {
    this.router.navigate(['/practices']);
  }

  // ── Engine ──────────────────────────────────────────────────────────────
  private startPrepare(): void {
    this.state = 'prepare';
    this.index = 0;
    this.phase = 'tense';
    this.phaseElapsed = 0;
    this.prepareCountdown = this.prepareSeconds;
    this.prepareStart = performance.now();
    this.loopPrepare();
  }

  private loopPrepare = (): void => {
    const elapsed = (performance.now() - this.prepareStart) / 1000;
    this.prepareCountdown = Math.max(
      Math.ceil(this.prepareSeconds - elapsed),
      1,
    );
    if (elapsed >= this.prepareSeconds) {
      this.enterPhase(0, 'tense');
      this.loop();
      return;
    }
    this.rafId = requestAnimationFrame(this.loopPrepare);
  };

  /** Restart the engine on group `i`, beginning with the tension phase. */
  private jumpTo(i: number): void {
    cancelAnimationFrame(this.rafId);
    this.enterPhase(i, 'tense');
    this.loop();
  }

  private enterPhase(i: number, phase: Phase): void {
    this.index = i;
    this.phase = phase;
    this.state = phase === 'tense' ? 'tensing' : 'releasing';
    this.phaseStart = performance.now();
    this.phaseElapsed = 0;
    this.countdown = this.phaseSeconds;
    this.playCue(phase);
  }

  private loop = (): void => {
    this.phaseElapsed = (performance.now() - this.phaseStart) / 1000;
    this.countdown = Math.max(
      Math.ceil(this.phaseSeconds - this.phaseElapsed),
      1,
    );

    if (this.phaseElapsed >= this.phaseSeconds) {
      if (this.phase === 'tense') {
        this.enterPhase(this.index, 'release');
      } else if (this.index + 1 < this.groups.length) {
        this.enterPhase(this.index + 1, 'tense');
      } else {
        this.finish();
        return;
      }
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  private pause(): void {
    this.pausedPhaseElapsed = (performance.now() - this.phaseStart) / 1000;
    cancelAnimationFrame(this.rafId);
    this.state = 'paused';
  }

  private resume(): void {
    this.state = this.phase === 'tense' ? 'tensing' : 'releasing';
    // Rewind the clock so the phase resumes where it was paused.
    this.phaseStart = performance.now() - this.pausedPhaseElapsed * 1000;
    this.loop();
  }

  private finish(): void {
    cancelAnimationFrame(this.rafId);
    this.state = 'done';
    this.index = this.groups.length - 1;
    this.phase = 'release';
    this.phaseElapsed = this.releaseSeconds;
  }

  /**
   * Soft sine cue marking a phase change — a brighter note as the muscles
   * tense, a lower, gentler one as they release.
   */
  private playCue(phase: Phase): void {
    const ctx = this.audioCtx;
    if (!this.soundOn || !ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = phase === 'tense' ? 528 : 396;

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.92);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    this.audioCtx?.close();
  }
}
