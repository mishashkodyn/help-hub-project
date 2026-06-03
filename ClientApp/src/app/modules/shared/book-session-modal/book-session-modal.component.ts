import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { finalize } from 'rxjs';
import { AvailableSlot, CreateAppointmentDto } from '../../../api/models/psychologist.model';
import { BookingResultDto } from '../../../api/models/session.model';
import { PsychologistService } from '../../../api/services/psychologist.service';
import { AppointmentClientService } from '../../../api/services/appointment-client.service';
import { MatSnackBar } from '@angular/material/snack-bar';

type ModalStep = 'booking' | 'payment' | 'free-confirmed';

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

  step: ModalStep = 'booking';
  bookingResult: BookingResultDto | null = null;

  selectedDate: string = '';
  availableSlots: AvailableSlot[] = [];
  selectedSlot: AvailableSlot | null = null;
  clientNotes: string = '';

  isLoadingSlots: boolean = false;
  isSubmitting: boolean = false;
  isCancelling: boolean = false;

  minDate: string;

  constructor(
    private appointmentService: PsychologistService,
    private appointmentClientService: AppointmentClientService,
    private snackBar: MatSnackBar,
  ) {
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
        next: (result: BookingResultDto) => {
          this.bookingResult = result;
          this.step = result.isFree ? 'free-confirmed' : 'payment';
          // НЕ емітимо bookingSuccess тут — батько закриє модалку.
          // Покажемо інструкції оплати, користувач сам закриє.
        },
        error: (err) => {
          console.error('Booking failed:', err);
        }
      });
  }

  close(): void {
    // Якщо вже пройшло бронювання — повідомляємо батька (щоб оновив дані),
    // а потім закриваємо.
    if (this.bookingResult) {
      this.bookingSuccess.emit();
    }
    this.closeModal.emit();
  }

  cancelBooking(): void {
    if (!this.bookingResult || this.isCancelling) return;

    this.isCancelling = true;
    this.appointmentClientService.cancelByClient(this.bookingResult.appointmentId)
      .pipe(finalize(() => (this.isCancelling = false)))
      .subscribe({
        next: () => {
          this.snackBar.open('Бронювання скасовано.', 'Закрити', { duration: 2500 });
          this.bookingSuccess.emit();
          this.closeModal.emit();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.error || 'Не вдалось скасувати.', 'Закрити', { duration: 3000 });
        },
      });
  }

  formatCardNumber(card: string): string {
    if (!card) return '—';
    return card.replace(/(.{4})/g, '$1 ').trim();
  }

  formatLocalDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
