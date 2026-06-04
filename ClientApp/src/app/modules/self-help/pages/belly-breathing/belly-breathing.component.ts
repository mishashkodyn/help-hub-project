import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

/** Belly breathing has just two phases — a short in-breath and a longer out-breath. */
type BellyPhaseType = 'inhale' | 'exhale';

interface BellyPhase {
  type: BellyPhaseType;
  /** Duration of the phase, in seconds. */
  seconds: number;
}

/** Player lifecycle. `prepare` is the 3-2-1 lead-in before the first inhale. */
type PlayerState = 'idle' | 'prepare' | 'running' | 'paused' | 'done';

/**
 * Belly (diaphragmatic) breathing exercise.
 *
 * The point of the practice is a slow, low breath where the belly — not the
 * chest — does the moving, with the out-breath a little longer than the in.
 * The guide is a soft orb that both rises and inflates on the in-breath, then
 * sinks and deflates over the longer out-breath, echoing a belly filling and
 * emptying. Unlike the cycle-based box/4-7-8 players this one runs for a chosen
 * length of time, since the practice is meant to be held for a few minutes;
 * motion is driven by `requestAnimationFrame` off a `performance.now()` clock.
 */
@Component({
  selector: 'app-belly-breathing',
  standalone: false,
  templateUrl: './belly-breathing.component.html',
  styleUrl: './belly-breathing.component.scss',
})
export class BellyBreathingComponent implements OnDestroy {
  /** Orb travel + size, in viewBox units, between rest and a full breath. */
  private readonly restCy = 60;
  private readonly peakCy = 42;
  private readonly restR = 15;
  private readonly peakR = 24;

  /** Session lengths (minutes) the user can pick from. */
  readonly durations = [2, 3, 5];
  durationMinutes = 3;

  /** Seconds of lead-in before the first inhale. */
  private readonly prepareSeconds = 3;

  readonly phases: BellyPhase[] = [
    { type: 'inhale', seconds: 4 },
    { type: 'exhale', seconds: 6 },
  ];

  state: PlayerState = 'idle';
  phaseIndex = 0;
  cycles = 0;
  /** Whole-second countdown shown inside the orb. */
  countdown = this.phases[0].seconds;
  prepareCountdown = this.prepareSeconds;
  /** Seconds left in the whole session, drives the progress bar. */
  sessionRemaining = this.durationMinutes * 60;
  soundOn = false;

  /** Orb geometry, bound to the SVG circle. */
  orbCy = this.restCy;
  orbR = this.restR;

  private rafId = 0;
  private phaseStart = 0;
  private prepareStart = 0;
  private sessionStart = 0;
  private pausedPhaseElapsed = 0;
  private pausedSessionElapsed = 0;
  private audioCtx?: AudioContext;

  constructor(private router: Router) {}

  // ── Derived view state ──────────────────────────────────────────────────
  get currentLabel(): BellyPhaseType {
    return this.phases[this.phaseIndex].type;
  }

  get isRunning(): boolean {
    return this.state === 'running';
  }

  get isActiveSession(): boolean {
    return this.state === 'running' || this.state === 'paused';
  }

  get targetSeconds(): number {
    return this.durationMinutes * 60;
  }

  /** 0..1 fraction of the chosen session length elapsed. */
  get sessionProgress(): number {
    const elapsed = this.targetSeconds - this.sessionRemaining;
    return Math.min(elapsed / this.targetSeconds, 1);
  }

  /** Time left as m:ss for the progress row. */
  get timeRemaining(): string {
    const left = Math.max(Math.ceil(this.sessionRemaining), 0);
    const m = Math.floor(left / 60);
    const s = left % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /** Highlights the phase currently being breathed in the legend. */
  phaseActive(index: number): boolean {
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
    this.countdown = this.phases[0].seconds;
    this.prepareCountdown = this.prepareSeconds;
    this.sessionRemaining = this.targetSeconds;
    this.orbCy = this.restCy;
    this.orbR = this.restR;
  }

  /** Length can only change while not mid-session, to keep the rhythm stable. */
  setDuration(minutes: number): void {
    if (this.isActiveSession || this.durationMinutes === minutes) return;
    this.durationMinutes = minutes;
    this.sessionRemaining = this.targetSeconds;
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
    this.sessionRemaining = this.targetSeconds;
    this.prepareCountdown = this.prepareSeconds;
    this.prepareStart = performance.now();
    this.orbCy = this.restCy;
    this.orbR = this.restR;
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
    this.cycles = 0;
    this.sessionStart = performance.now();
    this.enterPhase(0);
    this.loop();
  }

  private enterPhase(index: number): void {
    this.phaseIndex = index;
    this.phaseStart = performance.now();
    this.countdown = this.phases[index].seconds;
    this.playCue();
  }

  private loop = (): void => {
    const phase = this.phases[this.phaseIndex];
    const elapsed = (performance.now() - this.phaseStart) / 1000;
    const progress = Math.min(elapsed / phase.seconds, 1);

    this.updateOrb(phase.type, progress);
    this.countdown = Math.max(Math.ceil(phase.seconds - elapsed), 1);
    this.sessionRemaining =
      this.targetSeconds - (performance.now() - this.sessionStart) / 1000;

    if (elapsed >= phase.seconds) {
      const next = this.phaseIndex + 1;
      if (next >= this.phases.length) {
        this.cycles += 1;
        // End gracefully at the close of an out-breath once the time is up.
        if (this.sessionRemaining <= 0) {
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
    this.pausedSessionElapsed = (performance.now() - this.sessionStart) / 1000;
    cancelAnimationFrame(this.rafId);
    this.state = 'paused';
  }

  private resume(): void {
    this.state = 'running';
    // Rewind both clocks so the phase and the session resume where they paused.
    const now = performance.now();
    this.phaseStart = now - this.pausedPhaseElapsed * 1000;
    this.sessionStart = now - this.pausedSessionElapsed * 1000;
    this.loop();
  }

  private finish(): void {
    cancelAnimationFrame(this.rafId);
    this.state = 'done';
    this.sessionRemaining = 0;
    this.orbCy = this.restCy;
    this.orbR = this.restR;
  }

  /** Maps the current phase + progress to the orb's position and size. */
  private updateOrb(type: BellyPhaseType, progress: number): void {
    if (type === 'inhale') {
      // Belly rises and fills.
      this.orbCy = this.lerp(this.restCy, this.peakCy, progress);
      this.orbR = this.lerp(this.restR, this.peakR, progress);
    } else {
      // Belly sinks and empties over the longer out-breath.
      this.orbCy = this.lerp(this.peakCy, this.restCy, progress);
      this.orbR = this.lerp(this.peakR, this.restR, progress);
    }
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /** Soft sine cue on each phase change; higher on inhale, lower on exhale. */
  private playCue(): void {
    const ctx = this.audioCtx;
    if (!this.soundOn || !ctx) return;

    const freq = this.currentLabel === 'inhale' ? 528 : 396;

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
