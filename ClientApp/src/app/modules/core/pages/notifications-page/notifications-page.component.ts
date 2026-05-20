import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from '../../../../api/services/notification.service';
import { AppNotification } from '../../../../api/models/notification.model';
import { AuthService } from '../../../../api/services/auth.service';

@Component({
  selector: 'app-notifications-page',
  standalone: false,
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.scss'
})
export class NotificationsPageComponent {
  constructor(
    protected service: NotificationService,
    private router: Router,
    private authService: AuthService,
  ) {
  }

  onNotificationClick(notif: AppNotification){
    if (!notif.isRead && notif.id){
      notif.isRead = true;
      this.service.markAsRead(notif.id).subscribe();
    }

    if (!notif.relatedEntityId) return;

    const target = this.resolveTarget(notif);
    if (target) {
      this.router.navigate([target]);
    }
  }

  private resolveTarget(notif: AppNotification): string | null {
    if (this.isCategoryNotification(notif)) {
      return this.authService.isAdmin || this.authService.isSuperAdmin
        ? '/admin/category-applications'
        : '/category-application';
    }

    return this.authService.isPsychologist
      ? '/psychologist/applications'
      : '/my-sessions';
  }

  private isCategoryNotification(notif: AppNotification): boolean {
    const t = notif.type as unknown;
    return t === 4 || t === '4' || t === 'UserCategoryApplication';
  }

  markAllAsRead() {
    this.service.markAllAsRead();
  }
}
