/**
 * Self-help practices (breathing, grounding, relaxation…).
 *
 * Only structural / non-text metadata lives here. Every user-visible string
 * (titles, descriptions, step text) is stored under the `selfHelp.items.*`
 * keys in the Transloco files and resolved at runtime, so the catalogue stays
 * fully localized (en + ua).
 */

export type PracticeCategory = 'breathing' | 'grounding' | 'relaxation';

export type BreathingPhaseType = 'inhale' | 'hold' | 'exhale';

export interface BreathingPhase {
  type: BreathingPhaseType;
  /** Duration of the phase, in seconds. */
  seconds: number;
}

export interface Practice {
  /** Stable slug used in the route (`/practices/:slug`) and i18n key. */
  slug: string;
  category: PracticeCategory;
  /** Material icon name. */
  icon: string;
  /** Approximate length of the practice, in minutes (shown on the card). */
  minutes: number;
  /**
   * For breathing practices — the repeating cycle of phases that drives the
   * animated breathing guide. Empty for step-based practices.
   */
  phases: BreathingPhase[];
}

/** Localized content for a single practice, resolved from Transloco. */
export interface PracticeContent {
  title: string;
  short: string;
  intro: string;
  steps: string[];
}

export const PRACTICE_CATEGORIES: PracticeCategory[] = [
  'breathing',
  'grounding',
  'relaxation',
];
