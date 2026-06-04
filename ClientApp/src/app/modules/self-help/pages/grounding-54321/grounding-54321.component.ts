import { Component } from '@angular/core';
import { Router } from '@angular/router';

/** One sense step of the 5-4-3-2-1 sequence. */
interface Sense {
  /** Suffix into `selfHelp.grounding.senses.*`. */
  key: 'see' | 'touch' | 'hear' | 'smell' | 'taste';
  /** How many things to notice for this sense. */
  count: number;
  /** Material icon name. */
  icon: string;
}

/** Player lifecycle. */
type PlayerState = 'idle' | 'running' | 'done';

/**
 * 5-4-3-2-1 grounding exercise.
 *
 * A guided sensory walk that pulls attention back to the present: five things
 * you can see, four you can touch, three you can hear, two you can smell and
 * one you can taste. The user moves through one sense at a time, optionally
 * jotting down what they notice in soft slots; finished slots light up so the
 * progress feels tangible without ever being demanded.
 */
@Component({
  selector: 'app-grounding-54321',
  standalone: false,
  templateUrl: './grounding-54321.component.html',
  styleUrl: './grounding-54321.component.scss',
})
export class Grounding54321Component {
  readonly senses: Sense[] = [
    { key: 'see', count: 5, icon: 'visibility' },
    { key: 'touch', count: 4, icon: 'back_hand' },
    { key: 'hear', count: 3, icon: 'hearing' },
    { key: 'smell', count: 2, icon: 'filter_vintage' },
    { key: 'taste', count: 1, icon: 'restaurant' },
  ];

  state: PlayerState = 'idle';
  /** Index into `senses` of the sense currently in focus. */
  index = 0;

  /** What the user noted, per sense — `entries[senseIndex][slot]`. */
  entries: string[][] = this.senses.map((s) => Array(s.count).fill(''));

  constructor(private router: Router) {}

  // ── Derived view state ──────────────────────────────────────────────────
  get current(): Sense {
    return this.senses[this.index];
  }

  get isFirst(): boolean {
    return this.index === 0;
  }

  get isLast(): boolean {
    return this.index === this.senses.length - 1;
  }

  /** Slots filled in (trimmed) for the sense at `i`. */
  filled(i: number): number {
    return this.entries[i].filter((v) => v.trim().length > 0).length;
  }

  /** A sense is "complete" once every slot has something in it. */
  isSenseComplete(i: number): boolean {
    return this.filled(i) === this.senses[i].count;
  }

  /** Senses fully noticed — drives the overall progress bar. */
  get completedSenses(): number {
    return this.senses.filter((_, i) => this.isSenseComplete(i)).length;
  }

  // ── Controls ────────────────────────────────────────────────────────────
  start(): void {
    this.state = 'running';
    this.index = 0;
  }

  next(): void {
    if (this.isLast) {
      this.finish();
      return;
    }
    this.index += 1;
  }

  prev(): void {
    if (this.isFirst) return;
    this.index -= 1;
  }

  /** Jump straight to a sense via the step dots. */
  goTo(i: number): void {
    if (this.state !== 'running') return;
    this.index = i;
  }

  private finish(): void {
    this.state = 'done';
  }

  reset(): void {
    this.state = 'idle';
    this.index = 0;
    this.entries = this.senses.map((s) => Array(s.count).fill(''));
  }

  goBack(): void {
    this.router.navigate(['/practices']);
  }

  trackByIndex(index: number): number {
    return index;
  }
}
