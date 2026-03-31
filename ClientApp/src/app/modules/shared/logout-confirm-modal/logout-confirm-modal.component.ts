import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-logout-confirm-modal',
  standalone: false,
  templateUrl: './logout-confirm-modal.component.html',
  styleUrl: './logout-confirm-modal.component.scss',
})
export class LogoutConfirmModalComponent {
  constructor(private dialogRef: MatDialogRef<LogoutConfirmModalComponent>) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
