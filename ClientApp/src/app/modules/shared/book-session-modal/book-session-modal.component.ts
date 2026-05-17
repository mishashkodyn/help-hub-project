import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { finalize } from 'rxjs';
import { CreateAppointmentDto } from '../../../api/models/psychologist.model';
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
  availableSlots: string[] = [];
  selectedTime: string | null = null;
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
      this.selectedTime = null; 
      this.fetchSlots();
    }
  }

  selectTime(time: string): void {
    this.selectedTime = time;
  }

  fetchSlots(): void {
    if (!this.selectedDate || !this.psychologistId) return;

    this.isLoadingSlots = true;
    this.availableSlots = [];

    this.appointmentService.getAvailableSlots(this.psychologistId, this.selectedDate)
      .pipe(finalize(() => this.isLoadingSlots = false))
      .subscribe({
        next: (slots) => {
          this.availableSlots = slots;
        },
        error: (err) => {
          console.error('Error fetching slots:', err);
        }
      });
  }

  confirmBooking(): void {
    if (!this.selectedTime || this.isSubmitting) return;

    this.isSubmitting = true;

    const payload: CreateAppointmentDto = {
      psychologistId: this.psychologistId,
      date: this.selectedDate,
      startTime: this.selectedTime,
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
