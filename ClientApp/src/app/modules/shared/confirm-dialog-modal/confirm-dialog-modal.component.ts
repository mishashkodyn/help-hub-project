import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialogData } from '../../../api/models/confirm-dialog-data';

@Component({
  selector: 'app-confirm-dialog-modal',
  standalone: false,
  templateUrl: './confirm-dialog-modal.component.html',
  styleUrl: './confirm-dialog-modal.component.scss'
})
export class ConfirmDialogModalComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
