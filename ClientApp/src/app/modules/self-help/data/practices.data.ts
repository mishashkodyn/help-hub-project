import { Practice } from './practice.model';

/**
 * The static catalogue of self-help practices. To add a new practice:
 *   1. add an entry here (metadata only);
 *   2. add the matching `selfHelp.items.<slug>` block to en.json + ua.json.
 */
export const PRACTICES: Practice[] = [
  // ── Breathing ─────────────────────────────────────────────────────────
  {
    slug: 'box-breathing',
    category: 'breathing',
    icon: 'crop_square',
    minutes: 4,
    phases: [
      { type: 'inhale', seconds: 4 },
      { type: 'hold', seconds: 4 },
      { type: 'exhale', seconds: 4 },
      { type: 'hold', seconds: 4 },
    ],
  },
  {
    slug: 'breathing-478',
    category: 'breathing',
    icon: 'spa',
    minutes: 3,
    phases: [
      { type: 'inhale', seconds: 4 },
      { type: 'hold', seconds: 7 },
      { type: 'exhale', seconds: 8 },
    ],
  },
  {
    slug: 'belly-breathing',
    category: 'breathing',
    icon: 'air',
    minutes: 5,
    phases: [
      { type: 'inhale', seconds: 4 },
      { type: 'exhale', seconds: 6 },
    ],
  },

  // ── Grounding ─────────────────────────────────────────────────────────
  {
    slug: 'grounding-54321',
    category: 'grounding',
    icon: 'filter_5',
    minutes: 5,
    phases: [],
  },
  {
    slug: 'body-scan',
    category: 'grounding',
    icon: 'accessibility_new',
    minutes: 8,
    phases: [],
  },

  // ── Relaxation ────────────────────────────────────────────────────────
  {
    slug: 'progressive-muscle',
    category: 'relaxation',
    icon: 'self_improvement',
    minutes: 10,
    phases: [],
  },
  {
    slug: 'safe-place',
    category: 'relaxation',
    icon: 'cottage',
    minutes: 6,
    phases: [],
  },
];

export function findPractice(slug: string): Practice | undefined {
  return PRACTICES.find((p) => p.slug === slug);
}
