import { Component, OnInit } from '@angular/core';
import { ApplicationsService } from '../../../../api/services/applications.service';
import { PsychologistApplicationResponseDto } from '../../../../api/models/psychologist-application.model';
import { ApplicationDetailsDialogComponent } from '../../components/application-details-dialog/application-details-dialog.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-applications-page',
  standalone: false,
  templateUrl: './applications-page.component.html',
  styleUrl: './applications-page.component.scss',
})
export class ApplicationsPageComponent implements OnInit {
  applications: PsychologistApplicationResponseDto[] = [];
  filteredApplications: PsychologistApplicationResponseDto[] = [];

  isLoading = true;
  selectedApp: PsychologistApplicationResponseDto | null = null;

  searchQuery: string = '';
  statusFilter: string = 'All';
  availableStatuses = ['All', 'Pending', 'Approved', 'Rejected'];

  constructor(
    private service: ApplicationsService,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.loadApplications();
  }

  loadApplications() {
    this.isLoading = true;
    this.service.getPsychologistApplications().subscribe({
      next: (res) => {
        if (!res.isSuccess) {
          console.error('Error loading applications', res.message);
          this.isLoading = false;
          return;
        }
        this.applications = res.data;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading applications', err);
        this.isLoading = false;
      },
    });
  }

  onSearch(event: Event) {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.applyFilters();
  }

  setStatusFilter(status: string) {
    this.statusFilter = status;
    this.applyFilters();
  }

  applyFilters() {
    let tempApplications = [...this.applications];

    if (this.statusFilter !== 'All') {
      tempApplications = tempApplications.filter(
        (app) => app.status === this.statusFilter,
      );
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      tempApplications = tempApplications.filter(app => 
        app.firstName?.toLowerCase().includes(query) ||
        app.lastName?.toLowerCase().includes(query) ||
        app.email?.toLowerCase().includes(query) ||
        app.phone?.toLowerCase().includes(query)
      );
    }

    this.filteredApplications = tempApplications;
  }

  closeDetails() {
    this.selectedApp = null;
    document.body.style.overflow = 'auto';
  }

  reviewApplication(id: string, approved: boolean) {
    this.service.reviewApplication(id, approved).subscribe(() => {
      this.applications = this.applications.map((app) =>
        app.id === id
          ? { ...app, status: approved ? 'Approved' : 'Rejected' }
          : app,
      );
      this.applyFilters();
    });
  }

  viewDetails(app: PsychologistApplicationResponseDto) {
    const dialogRef = this.dialog.open(ApplicationDetailsDialogComponent, {
      width: '100%',
      maxWidth: '42rem',
      data: { app: app },
      panelClass: 'custom-dialog-container',
      autoFocus: false,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        if (result.action === 'approve') {
          this.reviewApplication(result.id, true);
        } else if (result.action === 'reject') {
          this.reviewApplication(result.id, false);
        }
      }
    });
  }
}
