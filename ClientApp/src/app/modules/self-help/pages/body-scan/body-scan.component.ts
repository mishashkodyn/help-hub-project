import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

/** One region of the body the attention rests on, bottom (feet) to top (head). */
interface BodyRegion {
  /** Suffix into `selfHelp.bodyScan.regions.*`. */
  key:
    | 'feet'
    | 'legs'
    | 'hips'
    | 'belly'
    | 'chest'
    | 'arms'
    | 'shoulders'
    | 'head';
  /** Vertical centre of the scan band, in the SVG's 0..200 viewBox. */
  y: number;
}

/** Player lifecycle. `prepare` is the short settle-in before the scan starts. */
type PlayerState = 'idle' | 'prepare' | 'running' | 'paused' | 'done';

/**
 * Body scan exercise.
 *
 * Attention is walked slowly from the feet up to the crown, one region at a
 * time. A soft glowing band sweeps up a body silhouette to show where the
 * focus rests now, while a per-region countdown paces the journey. The whole
 * session runs for a chosen length of time split evenly across the regions;
 * motion and timing are driven by `requestAnimationFrame` off a
 * `performance.now()` clock so the countdown stays accurate even if a frame is
 * dropped. The user can also step between regions by hand.
 */
@Component({
  selector: 'app-body-scan',
  standalone: false,
  templateUrl: './body-scan.component.html',
  styleUrl: './body-scan.component.scss',
})
export class BodyScanComponent implements OnDestroy {
  readonly regions: BodyRegion[] = [
    { key: 'feet', y: 190 },
    { key: 'legs', y: 162 },
    { key: 'hips', y: 122 },
    { key: 'belly', y: 100 },
    { key: 'chest', y: 80 },
    { key: 'arms', y: 66 },
    { key: 'shoulders', y: 50 },
    { key: 'head', y: 26 },
  ];

  /** Session lengths (minutes) the user can pick from. */
  readonly durations = [5, 8, 12];
  durationMinutes = 8;

  /** Seconds of settle-in before the scan begins. */
  private readonly prepareSeconds = 3;

  state: PlayerState = 'idle';
  /** Index into `regions` of the area currently in focus. */
  index = 0;
  /** Whole-second countdown left in the current region. */
  countdown = 0;
  prepareCountdown = this.prepareSeconds;
  soundOn = false;

  private rafId = 0;
  private regionStart = 0;
  private prepareStart = 0;
  /** Seconds elapsed in the current region — drives the progress bar. */
  private regionElapsed = 0;
  private pausedRegionElapsed = 0;
  private audioCtx?: AudioContext;

  constructor(private router: Router) {}

  // ── Derived view state ──────────────────────────────────────────────────
  get current(): BodyRegion {
    return this.regions[this.index];
  }

  get isRunning(): boolean {
    return this.state === 'running';
  }

  get isActiveSession(): boolean {
    return this.state === 'running' || this.state === 'paused';
  }

  get isFirst(): boolean {
    return this.index === 0;
  }

  get isLast(): boolean {
    return this.index === this.regions.length - 1;
  }

  get targetSeconds(): number {
    return this.durationMinutes * 60;
  }

  /** Equal share of the session given to each region. */
  get regionSeconds(): number {
    return this.targetSeconds / this.regions.length;
  }

  /** Vertical centre the scan band rests at, in viewBox units. */
  get bandY(): number {
    return this.current.y;
  }

  /** 0..1 fraction of the whole scan completed. */
  get progress(): number {
    const within = Math.min(this.regionElapsed / this.regionSeconds, 1);
    return (this.index + within) / this.regions.length;
  }

  /** Time left across the whole scan as m:ss. */
  get timeRemaining(): string {
    const regionsLeft = this.regions.length - 1 - this.index;
    const left =
      regionsLeft * this.regionSeconds +
      Math.max(this.regionSeconds - this.regionElapsed, 0);
    const whole = Math.max(Math.ceil(left), 0);
    const m = Math.floor(whole / 60);
    const s = whole % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
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
    this.index = 0;
    this.countdown = 0;
    this.regionElapsed = 0;
    this.prepareCountdown = this.prepareSeconds;
  }

  /** Length can only change while not mid-session, to keep the pacing steady. */
  setDuration(minutes: number): void {
    if (this.isActiveSession || this.durationMinutes === minutes) return;
    this.durationMinutes = minutes;
  }

  /** Step to a neighbouring region by hand; keeps the scan running. */
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
    this.regionElapsed = 0;
    this.prepareCountdown = this.prepareSeconds;
    this.prepareStart = performance.now();
    this.loopPrepare();
  }

  private loopPrepare = (): void => {
    const elapsed = (performance.now() - this.prepareStart) / 1000;
    this.prepareCountdown = Math.max(Math.ceil(this.prepareSeconds - elapsed), 1);
    if (elapsed >= this.prepareSeconds) {
      this.state = 'running';
      this.enterRegion(0);
      this.loop();
      return;
    }
    this.rafId = requestAnimationFrame(this.loopPrepare);
  };

  /** Restart the engine focused on region `i` while keeping it running. */
  private jumpTo(i: number): void {
    cancelAnimationFrame(this.rafId);
    this.state = 'running';
    this.enterRegion(i);
    this.loop();
  }

  private enterRegion(i: number): void {
    this.index = i;
    this.regionStart = performance.now();
    this.regionElapsed = 0;
    this.countdown = Math.ceil(this.regionSeconds);
    this.playCue();
  }

  private loop = (): void => {
    this.regionElapsed = (performance.now() - this.regionStart) / 1000;
    this.countdown = Math.max(
      Math.ceil(this.regionSeconds - this.regionElapsed),
      1,
    );

    if (this.regionElapsed >= this.regionSeconds) {
      const next = this.index + 1;
      if (next >= this.regions.length) {
        this.finish();
        return;
      }
      this.enterRegion(next);
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  private pause(): void {
    this.pausedRegionElapsed = (performance.now() - this.regionStart) / 1000;
    cancelAnimationFrame(this.rafId);
    this.state = 'paused';
  }

  private resume(): void {
    this.state = 'running';
    // Rewind the clock so the region resumes where it was paused.
    this.regionStart = performance.now() - this.pausedRegionElapsed * 1000;
    this.loop();
  }

  private finish(): void {
    cancelAnimationFrame(this.rafId);
    this.state = 'done';
    this.regionElapsed = this.regionSeconds;
  }

  /** Soft, low sine cue as the attention settles into a new region. */
  private playCue(): void {
    const ctx = this.audioCtx;
    if (!this.soundOn || !ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 432;

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
