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
      label: 'Find psychologist',
      route: '/catalog'
    },
    {
      icon: 'chat',
      label: 'Chat',
      route: 'chat',
    },
    {
      icon: 'mail',
      label: 'Notifications',
      route: 'notifications'
    }
  ]);

  adminItems = signal<MenuItem[]>([
    {
      icon: 'person',
      label: 'Users',
      route: 'users',
    },
    {
      icon: 'smart_toy',
      label: 'AI Assistant',
      route: 'ai-chat',
    },
    {
      icon: 'dashboard',
      label: "Dashboard",
      route: 'admin',
    },
    {
      icon: 'assignment',
      label: "Applications",
      route: 'applications',
    }
  ]);

  psychologistItems = signal<MenuItem[]>([
    {
      icon: 'psychology',
      label: 'Psychologist Dashboard',
      route: 'psychologist-dashboard',
    },
  ])

  constructor(
    protected authService: AuthService,
    protected sidebarService: SidebarService,
    private router: Router,
    private dialog: MatDialog,
    protected presenceService: PresenceService
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
