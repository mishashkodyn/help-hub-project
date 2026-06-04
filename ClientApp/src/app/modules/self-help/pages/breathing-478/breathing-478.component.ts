import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

/** The three phases of the 4-7-8 cycle, in order. */
type Phase478Type = 'inhale' | 'hold' | 'exhale';

interface Phase478 {
  type: Phase478Type;
  /** Fixed duration of the phase, in seconds (4, 7, 8). */
  seconds: number;
}

/** Player lifecycle. `prepare` is the 3-2-1 lead-in before the first inhale. */
type PlayerState = 'idle' | 'prepare' | 'running' | 'paused' | 'done';

/**
 * 4-7-8 breathing exercise.
 *
 * Unlike box breathing, the three phases have different lengths — inhale for 4,
 * hold for 7, exhale for 8 — and the long exhale is what settles the nervous
 * system. The guide is a soft orb that grows on the inhale, stays full through
 * the hold, then shrinks over the long exhale, with a progress ring tracing the
 * current phase. Motion is driven by `requestAnimationFrame` off a
 * `performance.now()` clock, so the orb stays smooth and the countdown stays
 * accurate even if a frame is dropped.
 */
@Component({
  selector: 'app-breathing-478',
  standalone: false,
  templateUrl: './breathing-478.component.html',
  styleUrl: './breathing-478.component.scss',
})
export class Breathing478Component implements OnDestroy {
  /** Orb scales between these bounds across a breath. */
  private readonly minScale = 0.5;
  private readonly maxScale = 1;

  /** Radius of the progress ring in viewBox units, and its circumference. */
  readonly ringRadius = 44;
  readonly ringCircumference = 2 * Math.PI * this.ringRadius;

  /** Full cycles to complete before the session is considered done. */
  readonly targetCycles = 4;

  /** Seconds of lead-in before the first inhale. */
  private readonly prepareSeconds = 3;

  readonly phases: Phase478[] = [
    { type: 'inhale', seconds: 4 },
    { type: 'hold', seconds: 7 },
    { type: 'exhale', seconds: 8 },
  ];

  state: PlayerState = 'idle';
  phaseIndex = 0;
  cycles = 0;
  /** Whole-second countdown shown inside the orb. */
  countdown = this.phases[0].seconds;
  prepareCountdown = this.prepareSeconds;
  soundOn = false;

  /** Orb scale (minScale..maxScale), bound to the SVG transform. */
  orbScale = this.minScale;
  /** Fraction of the current phase elapsed (0..1), drives the ring. */
  phaseProgress = 0;

  private rafId = 0;
  private phaseStart = 0;
  private prepareStart = 0;
  private pausedPhaseElapsed = 0;
  private audioCtx?: AudioContext;

  constructor(private router: Router) {}

  // ── Derived view state ──────────────────────────────────────────────────
  get currentPhase(): Phase478 {
    return this.phases[this.phaseIndex];
  }

  get currentLabel(): Phase478Type {
    return this.currentPhase.type;
  }

  get isRunning(): boolean {
    return this.state === 'running';
  }

  get isActiveSession(): boolean {
    return this.state === 'running' || this.state === 'paused';
  }

  /** Dash offset that fills the ring as the current phase progresses. */
  get ringOffset(): number {
    return this.ringCircumference * (1 - this.phaseProgress);
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
    this.orbScale = this.minScale;
    this.phaseProgress = 0;
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
    this.orbScale = this.minScale;
    this.phaseProgress = 0;
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
    this.enterPhase(0);
    this.loop();
  }

  private enterPhase(index: number): void {
    this.phaseIndex = index;
    this.phaseStart = performance.now();
    this.countdown = this.phases[index].seconds;
    this.phaseProgress = 0;
    this.playCue();
  }

  private loop = (): void => {
    const phase = this.phases[this.phaseIndex];
    const elapsed = (performance.now() - this.phaseStart) / 1000;
    const progress = Math.min(elapsed / phase.seconds, 1);

    this.phaseProgress = progress;
    this.updateOrb(phase.type, progress);
    this.countdown = Math.max(Math.ceil(phase.seconds - elapsed), 1);

    if (elapsed >= phase.seconds) {
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
    this.orbScale = this.minScale;
    this.phaseProgress = 0;
  }

  /** Maps the current phase + progress to the orb's scale. */
  private updateOrb(type: Phase478Type, progress: number): void {
    const span = this.maxScale - this.minScale;
    switch (type) {
      case 'inhale': // grow with the in-breath
        this.orbScale = this.minScale + progress * span;
        break;
      case 'hold': // stay full while holding
        this.orbScale = this.maxScale;
        break;
      case 'exhale': // shrink over the long out-breath
        this.orbScale = this.maxScale - progress * span;
        break;
    }
  }

  /** Soft sine cue on each phase change; higher on inhale, lower on exhale. */
  private playCue(): void {
    const ctx = this.audioCtx;
    if (!this.soundOn || !ctx) return;

    const type = this.currentPhase.type;
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
