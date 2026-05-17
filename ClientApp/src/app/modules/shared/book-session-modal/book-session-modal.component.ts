import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { finalize } from 'rxjs';
import { AvailableSlot, CreateAppointmentDto } from '../../../api/models/psychologist.model';
import { PsychologistService } from '../../../api/services/psychologist.service';

@Component({
  selector: 'app-book-session-modal',
  standalone: false,
  templateUrl: './book-session-modal.component.html',
  styleUrl: './book-session-modal.component.scss'
})
export class BookSessionModalComponent implements OnInit {
  @Input() psychologistId!: string;
  @Input() psychologistName: string = 'the psychologist';
  @Output() closeModal = new EventEmitter<void>();
  @Output() bookingSuccess = new EventEmitter<void>();

  selectedDate: string = '';
  availableSlots: AvailableSlot[] = [];
  selectedSlot: AvailableSlot | null = null;
  clientNotes: string = '';

  isLoadingSlots: boolean = false;
  isSubmitting: boolean = false;

  minDate: string;

  constructor(private appointmentService: PsychologistService) {
    const today = new Date();
    this.minDate = this.formatDate(today);
    this.selectedDate = this.minDate;
  }

  ngOnInit(): void {
    document.body.style.overflow = 'hidden';
    this.fetchSlots();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = 'auto';
  }

  close(): void {
    this.closeModal.emit();
  }

  onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.selectedDate = input.value;
      this.selectedSlot = null;
      this.fetchSlots();
    }
  }

  selectSlot(slot: AvailableSlot): void {
    this.selectedSlot = slot;
  }

  fetchSlots(): void {
    if (!this.selectedDate || !this.psychologistId) return;

    this.isLoadingSlots = true;
    this.availableSlots = [];

    this.appointmentService.getAvailableSlots(this.psychologistId, this.selectedDate)
      .pipe(finalize(() => this.isLoadingSlots = false))
      .subscribe({
        next: (utcSlots) => {
          this.availableSlots = utcSlots.map(iso => ({
            startTimeUtc: iso,
            label: this.formatLocalTime(iso),
          }));
        },
        error: (err) => {
          console.error('Error fetching slots:', err);
        }
      });
  }

  confirmBooking(): void {
    if (!this.selectedSlot || this.isSubmitting) return;

    this.isSubmitting = true;

    const payload: CreateAppointmentDto = {
      psychologistId: this.psychologistId,
      startTimeUtc: this.selectedSlot.startTimeUtc,
      clientNotes: this.clientNotes
    };

    this.appointmentService.createAppointment(payload)
      .pipe(finalize(() => this.isSubmitting = false))
      .subscribe({
        next: () => {
          console.log('Booking successful!');
          this.bookingSuccess.emit();
          this.close();
        }
      });
  }

  private formatLocalTime(iso: string): string {
    const d = new Date(iso);
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }

  private formatDate(date: Date): string {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
  }
}
