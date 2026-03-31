import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SpecializationAdminDto } from '../../../../api/models/specialization.model';

@Component({
  selector: 'app-specialization-dialog',
  standalone: false,
  templateUrl: './specialization-dialog.component.html',
  styleUrl: './specialization-dialog.component.scss'
})
export class SpecializationDialogComponent implements OnInit {
  nameControl = new FormControl('', [Validators.required, Validators.minLength(2)]);
  isEditMode = false;

  constructor(
    public dialogRef: MatDialogRef<SpecializationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { spec?: SpecializationAdminDto }
  ) {}

  ngOnInit(): void {
    if (this.data && this.data.spec) {
      this.isEditMode = true;
      this.nameControl.setValue(this.data.spec.name);
    }
  }

  save(): void {
    if (this.nameControl.valid) {
      this.dialogRef.close(this.nameControl.value);
    } else {
      this.nameControl.markAsTouched();
    }
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
