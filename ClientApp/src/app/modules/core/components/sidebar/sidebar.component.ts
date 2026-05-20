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

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  @Output() widthChanged = new EventEmitter<string>();

  sidebarCollapsed = signal(true);

  menuItems = signal<MenuItem[]>([
    {
      icon: 'people',
      label: 'find_psychologist',
      route: '/catalog'
    },
    {
      icon: 'event',
      label: 'sessions',
      route: '/my-sessions'
    },
    {
      icon: 'chat',
      label: 'chat',
      route: 'chat',
    },
    {
      icon: 'mail',
      label: 'notifications',
      route: 'notifications'
    },
    {
      icon: 'verified_user',
      label: 'category_application',
      route: 'category-application'
    }
  ]);

  adminItems = signal<MenuItem[]>([
    {
      icon: 'smart_toy',
      label: 'ai_assistant',
      route: 'ai-chat',
    },
    {
      icon: 'dashboard',
      label: "dashboard",
      route: 'admin',
    }
  ]);

  psychologistItems = signal<MenuItem[]>([
    {
      icon: 'psychology',
      label: 'psychologist_dashboard',
      route: 'psychologist',
    },
    {
      icon: 'videocam',
      label: 'sessions',
      route: 'psychologist/sessions',
    },
    {
      icon: 'assignment',
      label: 'applications',
      route: 'psychologist/applications',
    },
    {
      icon: 'history',
      label: 'past_sessions',
      route: 'psychologist/past-sessions',
    },
  ])

  constructor(
    protected authService: AuthService,
    protected sidebarService: SidebarService,
    private router: Router,
    private dialog: MatDialog,
    protected presenceService: PresenceService,
    protected activeSessionService: ActiveSessionService
  ) {}

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
