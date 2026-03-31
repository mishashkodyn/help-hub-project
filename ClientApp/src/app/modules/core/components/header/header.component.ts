import { Component, HostListener, signal } from '@angular/core';
import { MenuItem } from '../../../../api/models/menu-item';
import { Router } from '@angular/router';
import { AuthService } from '../../../../api/services/auth.service';
import { DropdownItem } from '../../../../api/models/dropdown-item';
import { SidebarService } from '../../../../api/services/sidebar.service';
import { PresenceService } from '../../../../api/services/presence-service';
import { NotificationService } from '../../../../api/services/notification.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  standalone: false,
})
export class HeaderComponent {
  isNotificationsOpen = false;

  menuItems = signal<MenuItem[]>([
    {
      label: 'FAQ',
    },
    {
      label: 'About us',
    },
    {
      label: 'Contacts',
    },
  ]);

  languages: DropdownItem[] = [
    { label: 'EN', value: 'en' },
    { label: 'UA', value: 'ua' },
  ];

  currentLanguage = this.languages[0];

  constructor(
    protected route: Router,
    protected authService: AuthService,
    protected sidebarService: SidebarService,
    protected presenceService: PresenceService,
    protected notificationService: NotificationService,
  ) {}

  navigateTo(to: string) {
    switch (to) {
      case 'login': {
        this.route.navigate(['/login']);
        break;
      }
      case 'registration': {
        this.route.navigate(['/register']);
        break;
      }
      case 'home': {
        this.route.navigate(['/home']);
        break;
      }
      case 'chat': {
        this.route.navigate(['/chat']);
        break;
      }
      case 'ai-chat': {
        this.route.navigate(['/ai-chat']);
        break;
      }
    }
  }

  logout() {
    this.authService.logout();
  }

  isAuthRoute(): boolean {
    const path = this.route.url.split('?')[0];
    return ['/login', '/register', '/psychologist-registration'].includes(path);
  }

  toggleSideBar() {
    this.sidebarService.sideBarOpen.set(!this.sidebarService.sideBarOpen());
  }

  goToProfile() {
    this.route.navigate([`account/${this.authService.currentLoggedUser?.id}`]);
  }

  onLanguageChange() {
    console.log('Language changed to:', this.currentLanguage.value);
  }

  toggleNotificationsPopUp(event: Event) {
    event.stopPropagation();
    this.isNotificationsOpen = !this.isNotificationsOpen;
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.isNotificationsOpen = false;
  }
}
