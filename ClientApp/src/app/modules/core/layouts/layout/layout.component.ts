import {
  Component,
  computed,
  HostListener,
  signal,
  ViewChild,
} from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { SidebarService } from '../../../../api/services/sidebar.service';

@Component({
  selector: 'app-layout',
  standalone: false,
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  hidden = false;
  lastScroll = 0;

  constructor(protected sidebarService: SidebarService) {
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const currentScroll =
      window.pageYOffset || document.documentElement.scrollTop;

    if (currentScroll > this.lastScroll && currentScroll > 50) {
      this.hidden = true;
    } else {
      this.hidden = false;
    }

    this.lastScroll = currentScroll;
  }
}
