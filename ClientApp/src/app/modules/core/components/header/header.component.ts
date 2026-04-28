import { Component, HostListener, OnInit, signal } from '@angular/core';
import { MenuItem } from '../../../../api/models/menu-item';
import { Router } from '@angular/router';
import { AuthService } from '../../../../api/services/auth.service';
import { DropdownItem } from '../../../../api/models/dropdown-item';
import { SidebarService } from '../../../../api/services/sidebar.service';
import { PresenceService } from '../../../../api/services/presence-service';
import { NotificationService } from '../../../../api/services/notification.service';
import { TranslocoService } from '@ngneat/transloco';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  standalone: false,
})
export class HeaderComponent implements OnInit {
  isNotificationsOpen = false;

  constructor(
    protected route: Router,
    protected authService: AuthService,
    protected sidebarService: SidebarService,
    protected presenceService: PresenceService,
    protected notificationService: NotificationService,
    public translocoService: TranslocoService
  ) {}

  ngOnInit(): void {
    this.sidebarService.sideBarOpen.set(false);
  }

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
    { label: 'En', value: 'en' },
    { label: 'Укр', value: 'ua' },
  ];

  currentLanguage = this.languages[0];

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

  onLanguageChange(lang: string) {
    this.translocoService.setActiveLang(lang);
    this.currentLanguage = this.languages.find((l) => l.value === lang) || this.currentLanguage;
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
