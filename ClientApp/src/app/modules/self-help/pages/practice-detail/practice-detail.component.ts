import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoService } from '@ngneat/transloco';
import { Observable, Subscription } from 'rxjs';
import {
  BreathingPhase,
  BreathingPhaseType,
  Practice,
  PracticeContent,
} from '../../data/practice.model';
import { findPractice } from '../../data/practices.data';

@Component({
  selector: 'app-practice-detail',
  standalone: false,
  templateUrl: './practice-detail.component.html',
  styleUrl: './practice-detail.component.scss',
})
export class PracticeDetailComponent implements OnInit, OnDestroy {
  practice?: Practice;
  content$!: Observable<PracticeContent>;

  // ── Breathing player state ──────────────────────────────────────────────
  isBreathing = false;
  phaseType: BreathingPhaseType = 'inhale';
  /** Whole-second countdown shown inside the circle. */
  countdown = 0;
  /** Completed full cycles. */
  cycles = 0;
  /** 0.55 – 1, drives the CSS scale of the breathing circle. */
  circleScale = 0.55;
  /** Transition duration (ms) so the circle eases over the whole phase. */
  transitionMs = 0;

  private phaseIndex = 0;
  private secondsLeft = 0;
  private timer?: ReturnType<typeof setInterval>;
  private routeSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private transloco: TranslocoService,
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') ?? '';
      this.practice = findPractice(slug);

      if (!this.practice) {
        this.router.navigate(['/practices']);
        return;
      }

      this.resetBreathing();
      this.content$ = this.transloco.selectTranslateObject<PracticeContent>(
        `selfHelp.items.${slug}`,
      );
    });
  }

  get isBreathingPractice(): boolean {
    return !!this.practice && this.practice.phases.length > 0;
  }

  // ── Breathing controls ────────────────────────────────────────────────
  toggleBreathing(): void {
    if (this.isBreathing) {
      this.pauseBreathing();
    } else {
      this.startBreathing();
    }
  }

  private startBreathing(): void {
    if (!this.isBreathingPractice) return;

    this.isBreathing = true;
    // If we are resuming from a fresh/reset state, prime the first phase.
    if (this.secondsLeft === 0) {
      this.enterPhase(this.phaseIndex);
    }

    this.timer = setInterval(() => this.tick(), 1000);
  }

  pauseBreathing(): void {
    this.isBreathing = false;
    this.clearTimer();
  }

  resetBreathing(): void {
    this.clearTimer();
    this.isBreathing = false;
    this.phaseIndex = 0;
    this.secondsLeft = 0;
    this.cycles = 0;
    this.countdown = this.practice?.phases[0]?.seconds ?? 0;
    this.phaseType = this.practice?.phases[0]?.type ?? 'inhale';
    this.transitionMs = 0;
    this.circleScale = 0.55;
  }

  private tick(): void {
    this.secondsLeft -= 1;
    this.countdown = Math.max(this.secondsLeft, 0);

    if (this.secondsLeft <= 0) {
      const phases = this.practice!.phases;
      const next = (this.phaseIndex + 1) % phases.length;
      if (next === 0) {
        this.cycles += 1;
      }
      this.phaseIndex = next;
      this.enterPhase(next);
    }
  }

  private enterPhase(index: number): void {
    const phase: BreathingPhase = this.practice!.phases[index];
    this.phaseType = phase.type;
    this.secondsLeft = phase.seconds;
    this.countdown = phase.seconds;

    if (phase.type === 'inhale') {
      this.transitionMs = phase.seconds * 1000;
      this.circleScale = 1;
    } else if (phase.type === 'exhale') {
      this.transitionMs = phase.seconds * 1000;
      this.circleScale = 0.55;
    } else {
      // hold — freeze the circle at its current size
      this.transitionMs = 0;
    }
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  goBack(): void {
    this.router.navigate(['/practices']);
  }

  ngOnDestroy(): void {
    this.clearTimer();
    this.routeSub?.unsubscribe();
  }
}
