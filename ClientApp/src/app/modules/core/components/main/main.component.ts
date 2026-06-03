import {
  AfterViewInit,
  Component,
  ElementRef,
  HostBinding,
  OnDestroy,
} from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
  standalone: false,
})
export class MainComponent implements AfterViewInit, OnDestroy {
  /**
   * Arms the scroll-reveal hidden state. Until this is true (set only after JS
   * is confirmed running) every `[data-reveal]` element stays fully visible,
   * so content can never get stuck invisible the way the old AOS setup did.
   */
  @HostBinding('class.reveal-armed') armed = false;

  private observer?: IntersectionObserver;
  private fallbackTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private router: Router,
    private host: ElementRef<HTMLElement>,
  ) {}

  ngAfterViewInit(): void {
    const root = this.host.nativeElement;
    const targets = Array.from(
      root.querySelectorAll<HTMLElement>('[data-reveal]'),
    );

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // No reveal animation when it isn't safe/wanted — content stays visible.
    if (
      prefersReduced ||
      targets.length === 0 ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return;
    }

    // Arm the hidden state, then start observing on the next frame so the
    // initial opacity:0 is committed before elements are evaluated.
    this.armed = true;
    requestAnimationFrame(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              this.observer?.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.1, rootMargin: '0px 0px -8% 0px' },
      );

      targets.forEach((el) => this.observer!.observe(el));

      // Safety net: if anything goes wrong, force everything visible.
      this.fallbackTimer = setTimeout(() => {
        targets.forEach((el) => el.classList.add('is-visible'));
      }, 1500);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
  }

  navigateTo(path: string, queryParams?: { [key: string]: any }) {
    this.router.navigate([path], { queryParams });
  }
}
