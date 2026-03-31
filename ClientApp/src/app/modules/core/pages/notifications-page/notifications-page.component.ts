import { Component, OnInit } from '@angular/core';
import { NotificationService } from '../../../../api/services/notification.service';
import { AppNotification } from '../../../../api/models/notification.model';

@Component({
  selector: 'app-notifications-page',
  standalone: false,
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.scss'
})
export class NotificationsPageComponent {
  constructor(protected service: NotificationService) {
  }

  markAsRead(notif: AppNotification){
    if (notif.isRead) return;

    notif.isRead = true;

    if (notif.id){
      this.service.markAsRead(notif.id).subscribe();
    }
  }

  markAllAsRead() {
    this.service.markAllAsRead();
  }
}
