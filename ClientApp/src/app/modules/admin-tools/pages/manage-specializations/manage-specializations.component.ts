import { Component, OnInit } from '@angular/core';
import { SpecializationAdminDto } from '../../../../api/models/specialization.model';
import { SpecializationService } from '../../../../api/services/specializations.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SpecializationDialogComponent } from '../../components/specialization-dialog/specialization-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogModalComponent } from '../../../shared/confirm-dialog-modal/confirm-dialog-modal.component';
import { ConfirmDialogData } from '../../../../api/models/confirm-dialog-data';

@Component({
  selector: 'app-manage-specializations',
  standalone: false,
  templateUrl: './manage-specializations.component.html',
  styleUrl: './manage-specializations.component.scss',
})
export class ManageSpecializationsComponent implements OnInit {
  specializations: SpecializationAdminDto[] = [];
  filteredSpecializations: SpecializationAdminDto[] = [];

  isLoading = true;
  searchQuery = '';

  constructor(
    private service: SpecializationService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.loadSpecializations();
  }

  loadSpecializations() {
    this.isLoading = true;
    this.service.getSpecializationsForAdmin().subscribe({
      next: (res) => {
        if (!res.isSuccess) {
          this.showError('Failed to load specializations');
        } else if (res.data) {
          this.specializations = res.data;
          this.applyFilters();
        }
        this.isLoading = false;
      },
      error: () => {
        this.showError('Error connecting to server');
        this.isLoading = false;
      },
    });
  }

  onSearch(event: Event) {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.applyFilters();
  }

  applyFilters() {
    if (!this.searchQuery.trim()) {
      this.filteredSpecializations = [...this.specializations];
      return;
    }

    const query = this.searchQuery.toLowerCase().trim();
    this.filteredSpecializations = this.specializations.filter((s) =>
      s.name.toLowerCase().includes(query),
    );
  }

  addSpecialization() {
    const dialogRef = this.dialog.open(SpecializationDialogComponent, {
      width: '100%',
      maxWidth: '28rem',
      panelClass: 'custom-dialog-container',
      autoFocus: true,
      data: {},
    });

    dialogRef.afterClosed().subscribe((newName: string | null) => {
      if (!newName || !newName.trim()) return;

      this.service.createSpecialization({ name: newName.trim() }).subscribe({
        next: (res) => {
          if (res.isSuccess) {
            this.showSuccess('Topic created successfully');
            this.loadSpecializations();
          } else {
            this.showError(res.error || 'Creation failed');
          }
        },
        error: () => this.showError('Server error during creation'),
      });
    });
  }

  editSpecialization(spec: SpecializationAdminDto) {
    const dialogRef = this.dialog.open(SpecializationDialogComponent, {
      width: '100%',
      maxWidth: '28rem',
      panelClass: 'custom-dialog-container',
      autoFocus: true,
      data: { spec: spec },
    });

    dialogRef.afterClosed().subscribe((updatedName: string | null) => {
      if (
        !updatedName ||
        !updatedName.trim() ||
        updatedName.trim() === spec.name
      )
        return;

      this.service
        .updateSpecialization(spec.id, { name: updatedName.trim() })
        .subscribe({
          next: (res) => {
            if (res.isSuccess) {
              this.showSuccess('Topic updated');
              this.loadSpecializations();
            } else {
              this.showError(res.error || 'Update failed');
            }
          },
          error: () => this.showError('Server error during update'),
        });
    });
  }

  deleteItem(spec: SpecializationAdminDto) {
    var warningMessage = `Warning: This topic is currently used by ${spec.psychologistsCount} psychologists and ${spec.applicationsCount} applications. Are you sure you want to delete "${spec.name}"? This action cannot be undone.`;
    console.log("йоу");
    
    if (spec.psychologistsCount > 0 || spec.applicationsCount > 0) {
      warningMessage = `Warning: This topic is currently used by ${spec.psychologistsCount} psychologists and ${spec.applicationsCount} applications. Are you sure you want to delete "${spec.name}"? This action cannot be undone.`;
    }

    const dialogRef = this.dialog.open(ConfirmDialogModalComponent, {
      width: '100%',
      maxWidth: '28rem',
      panelClass: 'custom-dialog-container',
      data: {
        title: 'Delete Topic',
        message: warningMessage,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        isDestructive: true,
      } as ConfirmDialogData,
    });

    dialogRef.afterClosed().subscribe((isConfirmed: boolean) => {
      if (isConfirmed){
        this.deleteSpecialization(spec);
      }
    })
  }

  deleteSpecialization(spec: SpecializationAdminDto) {
    this.service.deleteSpecialization(spec.id).subscribe({
      next: (res) => {
        if (res.isSuccess) {
          this.showSuccess('Topic deleted');
          this.specializations = this.specializations.filter(
            (s) => s.id !== spec.id,
          );
          this.applyFilters();
        } else {
          this.showError(res.error || 'Deletion failed');
        }
      },
      error: () => this.showError('Server error during deletion'),
    });
  }

  private showSuccess(msg: string) {
    this.snackBar.open(msg, 'Close', {
      duration: 3000,
      panelClass: ['bg-green-600', 'text-white'],
    });
  }

  private showError(msg: string) {
    this.snackBar.open(msg, 'Close', {
      duration: 4000,
      panelClass: ['bg-red-600', 'text-white'],
    });
  }
}
