import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AppointmentApplicationDto, FilterType } from '../../../../api/models/psychologist.model';
import { PsychologistService } from '../../../../api/services/psychologist.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-psychologist-applications',
  standalone: false,
  templateUrl: './psychologist-applications.component.html',
  styleUrl: './psychologist-applications.component.scss',
})
export class PsychologistApplicationsComponent {
  allApplications: AppointmentApplicationDto[] = []; // Зберігаємо всі завантаженні з БД дані
  applications: AppointmentApplicationDto[] = [];
  isLoading: boolean = true;
  processingId: string | null = null; 
  currentSort: 'pendingFirst' | 'newestFirst' | 'oldestFirst' = 'pendingFirst';
  isSortDropdownOpen: boolean = false;
  currentFilter: FilterType = 'All';
  filterOptions: { value: FilterType; label: string; icon: string }[] = [
    { value: 'All', label: 'All', icon: 'apps' },
    { value: 'Pending', label: 'Pending', icon: 'error_outline' },
    { value: 'Confirmed', label: 'Confirmed', icon: 'event_available' },
    { value: 'Completed', label: 'Completed', icon: 'done_all' },
    { value: 'Cancelled', label: 'Cancelled', icon: 'block' }
  ];

  constructor(
    private router: Router,
    private appointmentService: PsychologistService
  ) {}

  ngOnInit(): void {
    this.loadApplications();
  }

  getSortLabel(): string {
    switch (this.currentSort) {
      case 'pendingFirst': return 'Pending First';
      case 'newestFirst': return 'Nearest Date';
      case 'oldestFirst': return 'Furthest Date';
      default: return 'Sort By';
    }
  }

  selectSort(sortValue: 'pendingFirst' | 'newestFirst' | 'oldestFirst'): void {
    this.currentSort = sortValue;
    this.isSortDropdownOpen = false;
    this.applySorting();
  }

  goBack(): void {
    this.router.navigate(['/psychologist']);
  }

  loadApplications(): void {
    this.isLoading = true;
    this.appointmentService.getPsychologistApplications()
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (data) => {
          this.allApplications = data;
          this.applySorting();
        },
        error: (err) => {
          console.error('Failed to load applications', err);
        }
      });
  }

  setFilter(filter: FilterType): void {
    this.currentFilter = filter;
    this.applySorting();
  }

  getFilterCount(filter: FilterType): number {
    if (filter === 'All') return this.allApplications.length;
    if (filter === 'Cancelled') return this.allApplications.filter(a => a.status === 'Cancelled' || a.status === 'NoShow').length;
    return this.allApplications.filter(a => a.status === filter).length;
  }

  applySorting(): void {
    let processed = [...this.allApplications];
    
    if (this.currentFilter !== 'All') {
      if (this.currentFilter === 'Cancelled') {
        processed = processed.filter(a => a.status === 'Cancelled' || a.status === 'NoShow');
      } else {
        processed = processed.filter(a => a.status === this.currentFilter);
      }
    }

    processed.sort((a, b) => {
      const timeA = new Date(a.startTime).getTime();
      const timeB = new Date(b.startTime).getTime();

      switch (this.currentSort) {
        case 'pendingFirst':
          if (a.status === 'Pending' && b.status !== 'Pending') return -1;
          if (a.status !== 'Pending' && b.status === 'Pending') return 1;
          return timeA - timeB;

        case 'newestFirst': return timeA - timeB;
        case 'oldestFirst': return timeB - timeA;
        default: return 0;
      }
    });

    this.applications = processed;
  }

  get pendingCount(): number {
    return this.applications.filter(a => a.status === 'Pending').length;
  }

  approve(id: string): void {
    this.processingId = id;
    this.appointmentService.approveAppointment(id)
      .pipe(finalize(() => this.processingId = null))
      .subscribe({
        next: () => {
          const app = this.applications.find(a => a.id === id);
          if (app) app.status = 'Confirmed';
          if (this.currentSort === 'pendingFirst') this.applySorting();
        },
        error: (err) => console.error(err)
      });
  }

  decline(id: string): void {
    this.processingId = id;
    this.appointmentService.declineAppointment(id)
      .pipe(finalize(() => this.processingId = null))
      .subscribe({
        next: () => {
          const app = this.applications.find(a => a.id === id);
          if (app) app.status = 'Cancelled';
          if (this.currentSort === 'pendingFirst') this.applySorting();
        },
        error: (err) => console.error(err)
      });
  }
}
