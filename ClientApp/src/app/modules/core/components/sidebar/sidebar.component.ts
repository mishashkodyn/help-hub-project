import {
  Component,
  computed,
  EventEmitter,
  Input,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { AuthService } from '../../../../api/services/auth.service';
import { User } from '../../../../api/models/user';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { LogoutConfirmModalComponent } from '../../../shared/logout-confirm-modal/logout-confirm-modal.component';
import { MenuItem } from '../../../../api/models/menu-item';
import { SidebarService } from '../../../../api/services/sidebar.service';
import { PresenceService } from '../../../../api/services/presence-service';
import { ActiveSessionService } from '../../../../api/services/active-session.service';
import { FeaturesService } from '../../../../api/services/features.service';

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  @Output() widthChanged = new EventEmitter<string>();

  sidebarCollapsed = signal(true);

  /** Client journey — only a regular user (not psychologist/admin) sees these. */
  clientItems = signal<MenuItem[]>([
    {
      icon: 'travel_explore',
      label: 'find_psychologist',
      route: '/catalog',
    },
    {
      icon: 'event',
      label: 'sessions',
      route: '/my-sessions',
    },
    {
      icon: 'self_improvement',
      label: 'self_help',
      route: '/practices',
    },
    {
      icon: 'verified_user',
      label: 'category_application',
      route: 'category-application',
    },
  ]);

  cameraWallEnabled = signal(false);

  /** Shown to everyone regardless of role. */
  commonItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [
      { icon: 'forum', label: 'chat', route: 'chat' },
      { icon: 'notifications', label: 'notifications', route: 'notifications' },
    ];
    if (this.cameraWallEnabled()) {
      items.push({ icon: 'videocam', label: 'cameras', route: 'cameras' });
    }
    return items;
  });

  /**
   * Staff entry points. The dashboards themselves already surface every
   * sub-page (sessions, applications, finances, past sessions…) through their
   * KPI cards and quick links, so we only keep the dashboard link here and
   * avoid duplicating navigation.
   */
  adminItems = signal<MenuItem[]>([
    {
      icon: 'dashboard',
      label: 'dashboard',
      route: 'admin',
    },
    {
      icon: 'smart_toy',
      label: 'ai_assistant',
      route: 'ai-chat',
    },
  ]);

  psychologistItems = signal<MenuItem[]>([
    {
      icon: 'space_dashboard',
      label: 'psychologist_dashboard',
      route: 'psychologist',
    },
  ]);

  /** A regular user has none of the staff roles. */
  isClient = computed(
    () =>
      !this.authService.isPsychologist &&
      !this.authService.isAdmin &&
      !this.authService.isSuperAdmin,
  );

  constructor(
    protected authService: AuthService,
    protected sidebarService: SidebarService,
    private router: Router,
    private dialog: MatDialog,
    protected presenceService: PresenceService,
    protected activeSessionService: ActiveSessionService,
    featuresService: FeaturesService,
  ) {
    featuresService.getFeatures().subscribe(f => this.cameraWallEnabled.set(f.cameraWall));
  }

  logout() {
    const dialogRef = this.dialog.open(LogoutConfirmModalComponent, {
      width: '350px',
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.authService.logout();
      }
    });
  }

  joinActiveSession(): void {
    const session = this.activeSessionService.activeSession();
    if (session) {
      this.router.navigate(['/session', session.id]);
      this.sidebarService.toggleSideBar();
    }
  }

  navigateTo(to: string) {
    switch (to) {
      case 'home': {
        this.router.navigate(['/home']);
        this.sidebarService.toggleSideBar();
        break;
      }
      case 'settings': {
        this.router.navigate(['/settings']);
        this.sidebarService.toggleSideBar();
        break;
      }
    }
  }
}
