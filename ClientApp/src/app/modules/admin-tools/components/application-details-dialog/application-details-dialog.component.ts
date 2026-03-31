import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PsychologistApplicationResponseDto } from '../../../../api/models/psychologist-application.model';

@Component({
  selector: 'app-application-details-dialog',
  standalone: false,
  templateUrl: './application-details-dialog.component.html',
  styleUrl: './application-details-dialog.component.scss',
})
export class ApplicationDetailsDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ApplicationDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: { app: PsychologistApplicationResponseDto },
  ) {}

  onReject() {
    this.dialogRef.close({ action: 'reject', id: this.data.app.id });
  }

  onApprove() {
    this.dialogRef.close({ action: 'approve', id: this.data.app.id });
  }

  onClose() {
    this.dialogRef.close();
  }

  getFileInfo(url: string) {
    const extension = url.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'pdf':
        return {
          icon: 'picture_as_pdf',
          color: 'text-red-500',
          bg: 'bg-red-50',
        };
      case 'doc':
      case 'docx':
      case 'txt':
        return {
          icon: 'description',
          color: 'text-blue-500',
          bg: 'bg-blue-50',
        };
      case 'xls':
      case 'xlsx':
        return {
          icon: 'table_chart',
          color: 'text-green-500',
          bg: 'bg-green-50',
        };
      case 'ppt':
      case 'pptx':
        return {
          icon: 'present_to_all',
          color: 'text-orange-500',
          bg: 'bg-orange-50',
        };
      case 'zip':
      case 'rar':
        return {
          icon: 'inventory_2',
          color: 'text-purple-500',
          bg: 'bg-purple-50',
        };
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return { icon: 'image', color: 'text-teal-500', bg: 'bg-teal-50' };
      default:
        return {
          icon: 'insert_drive_file',
          color: 'text-gray-500',
          bg: 'bg-gray-50',
        };
    }
  }
}
