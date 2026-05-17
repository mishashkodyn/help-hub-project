import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from '../../../../api/services/notification.service';
import { AppNotification } from '../../../../api/models/notification.model';
import { AuthService } from '../../../../api/services/auth.service';

@Component({
  selector: 'app-notifications-popup',
  standalone: false,
  templateUrl: './notifications-popup.component.html',
  styleUrl: './notifications-popup.component.scss',
})
export class NotificationsPopupComponent implements OnInit {
  @Output() closePopup = new EventEmitter<void>();

  constructor(
    private router: Router,
    protected service: NotificationService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
  }

  markAllAsRead() {
    this.service.markAllAsRead();
  }

  viewAll() {
    this.router.navigate(['/notifications']);
    this.closePopup.emit();
  }

  onNotificationClick(notif: AppNotification) {
    if (!notif.isRead) {
      notif.isRead = true;
      this.service.markAsRead(notif.id).subscribe();
    }

    if (notif.relatedEntityId) {
      const target = this.authService.isPsychologist
        ? '/psychologist/applications'
        : '/my-sessions';
      this.router.navigate([target]);
      this.closePopup.emit();
    }
  }
}
