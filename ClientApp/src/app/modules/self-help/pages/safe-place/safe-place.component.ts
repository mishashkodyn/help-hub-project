import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

/** One sensory anchor the visualisation rests on, in order. */
interface Anchor {
  /** Suffix into `selfHelp.safePlace.anchors.*`. */
  key: 'arrive' | 'look' | 'listen' | 'scent' | 'touch' | 'safe';
  /** Material icon shown in the focus ring. */
  icon: string;
}

/** Player lifecycle. `prepare` is the short settle-in before the first anchor. */
type PlayerState = 'idle' | 'prepare' | 'running' | 'paused' | 'done';

/**
 * Safe place visualisation.
 *
 * A guided imagery exercise: the user pictures a place — real or imagined —
 * where they feel completely safe, then settles into it one sense at a time
 * (sight, sound, smell, touch) before resting in the feeling of safety. A calm
 * landscape gently warms and comes alive behind the guidance, while a focus
 * ring marks the sense in play and a per-anchor countdown paces the journey.
 * The whole session runs for a chosen length split evenly across the anchors;
 * motion and timing are driven by `requestAnimationFrame` off a
 * `performance.now()` clock so the countdown stays accurate even if a frame is
 * dropped. The user can also step between anchors by hand.
 */
@Component({
  selector: 'app-safe-place',
  standalone: false,
  templateUrl: './safe-place.component.html',
  styleUrl: './safe-place.component.scss',
})
export class SafePlaceComponent implements OnDestroy {
  readonly anchors: Anchor[] = [
    { key: 'arrive', icon: 'cottage' },
    { key: 'look', icon: 'visibility' },
    { key: 'listen', icon: 'hearing' },
    { key: 'scent', icon: 'air' },
    { key: 'touch', icon: 'back_hand' },
    { key: 'safe', icon: 'favorite' },
  ];

  /** Session lengths (minutes) the user can pick from. */
  readonly durations = [4, 6, 9];
  durationMinutes = 6;

  /** Seconds of settle-in before the visualisation begins. */
  private readonly prepareSeconds = 3;

  state: PlayerState = 'idle';
  /** Index into `anchors` of the sense currently in focus. */
  index = 0;
  /** Whole-second countdown left in the current anchor. */
  countdown = 0;
  prepareCountdown = this.prepareSeconds;
  soundOn = false;

  private rafId = 0;
  private anchorStart = 0;
  private prepareStart = 0;
  /** Seconds elapsed in the current anchor — drives the progress bar. */
  private anchorElapsed = 0;
  private pausedAnchorElapsed = 0;
  private audioCtx?: AudioContext;

  constructor(private router: Router) {}

  // ── Derived view state ──────────────────────────────────────────────────
  get current(): Anchor {
    return this.anchors[this.index];
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
    return this.index === this.anchors.length - 1;
  }

  get targetSeconds(): number {
    return this.durationMinutes * 60;
  }

  /** Equal share of the session given to each anchor. */
  get anchorSeconds(): number {
    return this.targetSeconds / this.anchors.length;
  }

  /**
   * 0..1 warmth of the scene — it brightens as the journey unfolds, stays full
   * once finished, and rests calm before it begins.
   */
  get sceneWarmth(): number {
    if (this.state === 'done') return 1;
    if (!this.isActiveSession) return 0;
    return this.progress;
  }

  /** 0..1 fraction of the whole visualisation completed. */
  get progress(): number {
    const within = Math.min(this.anchorElapsed / this.anchorSeconds, 1);
    return (this.index + within) / this.anchors.length;
  }

  /** Time left across the whole session as m:ss. */
  get timeRemaining(): string {
    const anchorsLeft = this.anchors.length - 1 - this.index;
    const left =
      anchorsLeft * this.anchorSeconds +
      Math.max(this.anchorSeconds - this.anchorElapsed, 0);
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
    this.anchorElapsed = 0;
    this.prepareCountdown = this.prepareSeconds;
  }

  /** Length can only change while not mid-session, to keep the pacing steady. */
  setDuration(minutes: number): void {
    if (this.isActiveSession || this.durationMinutes === minutes) return;
    this.durationMinutes = minutes;
  }

  /** Step to a neighbouring anchor by hand; keeps the journey running. */
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
    this.anchorElapsed = 0;
    this.prepareCountdown = this.prepareSeconds;
    this.prepareStart = performance.now();
    this.loopPrepare();
  }

  private loopPrepare = (): void => {
    const elapsed = (performance.now() - this.prepareStart) / 1000;
    this.prepareCountdown = Math.max(Math.ceil(this.prepareSeconds - elapsed), 1);
    if (elapsed >= this.prepareSeconds) {
      this.state = 'running';
      this.enterAnchor(0);
      this.loop();
      return;
    }
    this.rafId = requestAnimationFrame(this.loopPrepare);
  };

  /** Restart the engine focused on anchor `i` while keeping it running. */
  private jumpTo(i: number): void {
    cancelAnimationFrame(this.rafId);
    this.state = 'running';
    this.enterAnchor(i);
    this.loop();
  }

  private enterAnchor(i: number): void {
    this.index = i;
    this.anchorStart = performance.now();
    this.anchorElapsed = 0;
    this.countdown = Math.ceil(this.anchorSeconds);
    this.playCue();
  }

  private loop = (): void => {
    this.anchorElapsed = (performance.now() - this.anchorStart) / 1000;
    this.countdown = Math.max(
      Math.ceil(this.anchorSeconds - this.anchorElapsed),
      1,
    );

    if (this.anchorElapsed >= this.anchorSeconds) {
      const next = this.index + 1;
      if (next >= this.anchors.length) {
        this.finish();
        return;
      }
      this.enterAnchor(next);
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  private pause(): void {
    this.pausedAnchorElapsed = (performance.now() - this.anchorStart) / 1000;
    cancelAnimationFrame(this.rafId);
    this.state = 'paused';
  }

  private resume(): void {
    this.state = 'running';
    // Rewind the clock so the anchor resumes where it was paused.
    this.anchorStart = performance.now() - this.pausedAnchorElapsed * 1000;
    this.loop();
  }

  private finish(): void {
    cancelAnimationFrame(this.rafId);
    this.state = 'done';
    this.index = this.anchors.length - 1;
    this.anchorElapsed = this.anchorSeconds;
  }

  /** Soft, low sine cue as the attention settles into a new anchor. */
  private playCue(): void {
    const ctx = this.audioCtx;
    if (!this.soundOn || !ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 396;

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.12);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    this.audioCtx?.close();
  }
}
