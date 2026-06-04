import { Component } from '@angular/core';
import { Router } from '@angular/router';
import {
  Practice,
  PracticeCategory,
  PRACTICE_CATEGORIES,
} from '../../data/practice.model';
import { PRACTICES } from '../../data/practices.data';

interface PracticeGroup {
  category: PracticeCategory;
  items: Practice[];
}

@Component({
  selector: 'app-practices-list',
  standalone: false,
  templateUrl: './practices-list.component.html',
  styleUrl: './practices-list.component.scss',
})
export class PracticesListComponent {
  groups: PracticeGroup[] = PRACTICE_CATEGORIES.map((category) => ({
    category,
    items: PRACTICES.filter((p) => p.category === category),
  })).filter((g) => g.items.length > 0);

  /** Soft accent palette per category — keeps cards calm, not clinical. */
  private categoryStyles: Record<
    PracticeCategory,
    { tint: string; icon: string }
  > = {
    breathing: {
      tint: 'bg-[var(--color-sky)]/15',
      icon: 'text-[var(--color-blue)]',
    },
    grounding: {
      tint: 'bg-[var(--color-mint)]/30',
      icon: 'text-[var(--color-success)]',
    },
    relaxation: {
      tint: 'bg-[var(--color-primary)]/10',
      icon: 'text-[var(--color-primary)]',
    },
  };

  constructor(private router: Router) {}

  tint(category: PracticeCategory): string {
    return this.categoryStyles[category].tint;
  }

  iconColor(category: PracticeCategory): string {
    return this.categoryStyles[category].icon;
  }

  open(practice: Practice): void {
    this.router.navigate(['/practices', practice.slug]);
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }
}
