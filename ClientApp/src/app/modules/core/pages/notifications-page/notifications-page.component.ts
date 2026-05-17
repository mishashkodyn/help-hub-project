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

    if (notif.relatedEntityId) {
      const target = this.authService.isPsychologist
        ? '/psychologist/applications'
        : '/my-sessions';
      this.router.navigate([target]);
    }
  }

  markAllAsRead() {
    this.service.markAllAsRead();
  }
}
