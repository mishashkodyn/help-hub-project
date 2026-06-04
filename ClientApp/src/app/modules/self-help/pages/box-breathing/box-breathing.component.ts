import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

/** The four sides of the box, walked clockwise from the bottom-left corner. */
type BoxPhaseType = 'inhale' | 'hold-in' | 'exhale' | 'hold-out';

interface BoxPhase {
  type: BoxPhaseType;
  /** Suffix into `selfHelp.phase.*` — both holds share the "hold" label. */
  label: 'inhale' | 'hold' | 'exhale';
}

/** Player lifecycle. `prepare` is the 3-2-1 lead-in before the first inhale. */
type PlayerState = 'idle' | 'prepare' | 'running' | 'paused' | 'done';

/**
 * Box (square) breathing exercise.
 *
 * The guide is a real square: a marker travels its perimeter, one side per
 * phase — up the left side while you inhale, across the top while you hold,
 * down the right side while you exhale, and back across the bottom while you
 * hold again. Motion is driven by `requestAnimationFrame` off a
 * `performance.now()` clock, so the dot stays smooth and the countdown stays
 * accurate even if a frame is dropped.
 */
@Component({
  selector: 'app-box-breathing',
  standalone: false,
  templateUrl: './box-breathing.component.html',
  styleUrl: './box-breathing.component.scss',
})
export class BoxBreathingComponent implements OnDestroy {
  /** SVG viewBox is 0..100; the track is inset by `pad` on every side. */
  readonly pad = 16;
  readonly size = 100;

  /** Equal-count paces (seconds per side) the user can pick from. */
  readonly paces = [3, 4, 5, 6];
  pace = 4;

  /** Full cycles to complete before the session is considered done. */
  readonly targetCycles = 6;

  /** Seconds of lead-in before the first inhale. */
  private readonly prepareSeconds = 3;

  private readonly phases: BoxPhase[] = [
    { type: 'inhale', label: 'inhale' },
    { type: 'hold-in', label: 'hold' },
    { type: 'exhale', label: 'exhale' },
    { type: 'hold-out', label: 'hold' },
  ];

  state: PlayerState = 'idle';
  phaseIndex = 0;
  cycles = 0;
  /** Whole-second countdown shown inside the square. */
  countdown = this.pace;
  prepareCountdown = this.prepareSeconds;
  soundOn = false;

  /** Marker position in viewBox units, bound to the SVG dot. */
  cx = this.pad;
  cy = this.size - this.pad;

  private rafId = 0;
  private phaseStart = 0;
  private prepareStart = 0;
  private pausedPhaseElapsed = 0;
  private audioCtx?: AudioContext;

  constructor(private router: Router) {
    this.updateDot(0, 0);
  }

  // ── Derived view state ──────────────────────────────────────────────────
  get currentLabel(): string {
    return this.phases[this.phaseIndex].label;
  }

  get isRunning(): boolean {
    return this.state === 'running';
  }

  get isActiveSession(): boolean {
    return this.state === 'running' || this.state === 'paused';
  }

  /** Highlights the side currently being breathed. */
  sideActive(index: number): boolean {
    return this.isActiveSession && this.phaseIndex === index;
  }

  // ── Controls ────────────────────────────────────────────────────────────
  toggle(): void {
    switch (this.state) {
      case 'running':
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
    this.phaseIndex = 0;
    this.cycles = 0;
    this.countdown = this.pace;
    this.prepareCountdown = this.prepareSeconds;
    this.updateDot(0, 0);
  }

  /** Pace can only change while not mid-session, to keep the rhythm stable. */
  setPace(seconds: number): void {
    if (this.isActiveSession || this.pace === seconds) return;
    this.pace = seconds;
    this.countdown = seconds;
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
    this.cycles = 0;
    this.prepareCountdown = this.prepareSeconds;
    this.prepareStart = performance.now();
    this.updateDot(0, 0);
    this.loopPrepare();
  }

  private loopPrepare = (): void => {
    const elapsed = (performance.now() - this.prepareStart) / 1000;
    this.prepareCountdown = Math.max(Math.ceil(this.prepareSeconds - elapsed), 1);
    if (elapsed >= this.prepareSeconds) {
      this.beginRun();
      return;
    }
    this.rafId = requestAnimationFrame(this.loopPrepare);
  };

  private beginRun(): void {
    this.state = 'running';
    this.phaseIndex = 0;
    this.cycles = 0;
    this.enterPhase(0);
    this.loop();
  }

  private enterPhase(index: number): void {
    this.phaseIndex = index;
    this.phaseStart = performance.now();
    this.countdown = this.pace;
    this.playCue();
  }

  private loop = (): void => {
    const elapsed = (performance.now() - this.phaseStart) / 1000;
    const progress = Math.min(elapsed / this.pace, 1);
    this.updateDot(this.phaseIndex, progress);
    this.countdown = Math.max(Math.ceil(this.pace - elapsed), 1);

    if (elapsed >= this.pace) {
      const next = this.phaseIndex + 1;
      if (next >= this.phases.length) {
        this.cycles += 1;
        if (this.cycles >= this.targetCycles) {
          this.finish();
          return;
        }
        this.enterPhase(0);
      } else {
        this.enterPhase(next);
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
    this.state = 'running';
    // Rewind the clock so the current phase resumes where it was paused.
    this.phaseStart = performance.now() - this.pausedPhaseElapsed * 1000;
    this.loop();
  }

  private finish(): void {
    cancelAnimationFrame(this.rafId);
    this.state = 'done';
    this.updateDot(0, 0);
  }

  /** Maps phase + intra-phase progress to a point on the square's perimeter. */
  private updateDot(index: number, progress: number): void {
    const lo = this.pad;
    const hi = this.size - this.pad;
    const span = hi - lo;
    switch (this.phases[index].type) {
      case 'inhale': // up the left side
        this.cx = lo;
        this.cy = hi - progress * span;
        break;
      case 'hold-in': // across the top
        this.cx = lo + progress * span;
        this.cy = lo;
        break;
      case 'exhale': // down the right side
        this.cx = hi;
        this.cy = lo + progress * span;
        break;
      case 'hold-out': // back across the bottom
        this.cx = hi - progress * span;
        this.cy = hi;
        break;
    }
  }

  /** Soft sine cue on each phase change; higher on inhale, lower on exhale. */
  private playCue(): void {
    const ctx = this.audioCtx;
    if (!this.soundOn || !ctx) return;

    const type = this.phases[this.phaseIndex].type;
    const freq = type === 'inhale' ? 528 : type === 'exhale' ? 396 : 440;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.62);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    this.audioCtx?.close();
  }
}
