import { Component, OnInit } from '@angular/core';
import { PsychologistService } from '../../../../api/services/psychologist.service';
import {
  DayScheduleDto,
  WeekDay,
} from '../../../../api/models/psychologist.model';
import { finalize } from 'rxjs';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogModalComponent } from '../../../shared/confirm-dialog-modal/confirm-dialog-modal.component';

@Component({
  selector: 'app-psychologist-calendar-page',
  standalone: false,
  templateUrl: './psychologist-calendar-page.component.html',
  styleUrl: './psychologist-calendar-page.component.scss',
})
export class PsychologistCalendarPageComponent implements OnInit {
  selectedDay: number = 1;
  isLoading: boolean = false;
  isSaving: boolean = false;
  hasChanges: boolean = false;
  isCopied: boolean = false;
  isSaved: boolean = false;

  weekDays: WeekDay[] = [
    { id: 1, name: 'Monday', isActive: false, slots: [] },
    { id: 2, name: 'Tuesday', isActive: false, slots: [] },
    { id: 3, name: 'Wednesday', isActive: false, slots: [] },
    { id: 4, name: 'Thursday', isActive: false, slots: [] },
    { id: 5, name: 'Friday', isActive: false, slots: [] },
    { id: 6, name: 'Saturday', isActive: false, slots: [] },
    { id: 0, name: 'Sunday', isActive: false, slots: [] },
  ];

  constructor(
    private psychologistService: PsychologistService,
    private router: Router,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.loadSchedule();
  }

  private loadSchedule(): void {
    this.isLoading = true;
    this.hasChanges = false;

    this.psychologistService
      .getSchedule()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response: any) => {
          const schedule: DayScheduleDto[] =
            response?.schedule || response || [];

          this.weekDays.forEach((uiDay) => {
            const fetchedDay = schedule.find((d) => d.dayOfWeek === uiDay.id);

            if (fetchedDay && fetchedDay.slots && fetchedDay.slots.length > 0) {
              uiDay.isActive = true;
              uiDay.slots = fetchedDay.slots.map((s) => ({
                start: s.startTime?.substring(0, 5) || '',
                end: s.endTime?.substring(0, 5) || '',
              }));
            } else {
              uiDay.isActive = false;
              uiDay.slots = [];
            }
          });
        },
        error: (err) => {
          console.error('Помилка завантаження графіка:', err);
        },
      });
  }

  markAsChanged(): void {
    this.hasChanges = true;
  }

  copyToAll(): void {
    const currentDay = this.getSelectedDay();

    if (!currentDay) return;

    this.weekDays.forEach((day) => {
      if (day.id !== currentDay.id) {
        day.isActive = currentDay.isActive;

        day.slots = currentDay.slots.map((slot) => ({
          start: slot.start,
          end: slot.end,
        }));
      }
    });

    this.markAsChanged();

    this.isCopied = true;
    setTimeout(() => {
      this.isCopied = false;
    }, 3000);
  }

  selectDay(dayId: number) {
    this.selectedDay = dayId;
  }

  getSelectedDay(): WeekDay | undefined {
    return this.weekDays.find((day) => day.id === this.selectedDay);
  }

  toggleSelectedDay() {
    const day = this.getSelectedDay();
    if (day) {
      day.isActive = !day.isActive;
      if (day.isActive && day.slots.length === 0) {
        day.slots.push({ start: '09:00', end: '17:00' });
      }
      this.markAsChanged();
    }
  }

  addSlot() {
    const day = this.getSelectedDay();
    if (day) {
      day.slots.push({ start: '', end: '' });
      this.markAsChanged();
    }
  }

  removeSlot(index: number) {
    const day = this.getSelectedDay();
    if (day) {
      day.slots.splice(index, 1);
      if (day.slots.length === 0) {
        day.isActive = false;
      }
      this.markAsChanged();
    }
  }

  saveChanges(): void {
    if (this.isSaving) return;

    this.isSaving = true;

    const payload: DayScheduleDto[] = this.weekDays
      .filter((day) => day.isActive && day.slots.length > 0)
      .map((day) => {
        const validSlots = day.slots.filter((slot) => slot.start && slot.end);

        return {
          dayOfWeek: day.id,
          slots: validSlots.map((slot) => ({
            startTime:
              slot.start.length === 5 ? `${slot.start}:00` : slot.start,
            endTime: slot.end.length === 5 ? `${slot.end}:00` : slot.end,
          })),
        };
      })
      .filter((mappedDay) => mappedDay.slots.length > 0);

    this.psychologistService
      .saveSchedule(payload)
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: () => {
          this.hasChanges = false;
          this.isSaved = true;

          setTimeout(() => {
            this.isSaved = false;
          }, 3000);
        },
        error: (err) => {
          console.error('Помилка збереження:', err);
        },
      });
  }

  goBack(): void {
    if (!this.hasChanges) {
      this.router.navigate(['/psychologist']);
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogModalComponent, {
      width: '400px',
      data: {
        title: 'Unsaved Changes',
        message: 'You have unsaved changes in your schedule. Are you sure you want to leave without saving?',
        confirmText: 'Leave without saving',
        cancelText: 'Stay',
        isDestructive: true 
      }
    });

    dialogRef.afterClosed().subscribe((result: boolean) => {
      if (result) {
        this.router.navigate(['/psychologist']);
      }
    });
  }
}
