import { Component, Input } from '@angular/core';
import { UserProfileDto } from '../../../../api/models/user';

@Component({
  selector: 'app-about-user-profile',
  standalone: false,
  templateUrl: './about-user-profile.component.html',
  styleUrl: './about-user-profile.component.scss',
})
export class AboutUserProfileComponent {
  user: UserProfileDto | null = null;
  weeklySchedule: any[] = [];

  @Input() set userInpt(value: UserProfileDto) {
    if (value) {
      this.user = value;
      this.buildDisplaySchedule(value.psychologist?.workingHours || []);
    }
  }

  private buildDisplaySchedule(workingHours: any[]): void {
    const daysTemplate = [
      { id: 1, name: 'Monday' },
      { id: 2, name: 'Tuesday' },
      { id: 3, name: 'Wednesday' },
      { id: 4, name: 'Thursday' },
      { id: 5, name: 'Friday' },
      { id: 6, name: 'Saturday' },
      { id: 0, name: 'Sunday' }
    ];

    this.weeklySchedule = daysTemplate.map(day => {
      const daySlots = workingHours.filter(wh => wh.dayOfWeek === day.id);
      
      if (daySlots.length > 0) {
        return {
          ...day,
          isWorking: true,
          slots: daySlots
            .map(s => ({
              start: s.startTime.substring(0, 5), // '09:00:00' -> '09:00'
              end: s.endTime.substring(0, 5)
            }))
            .sort((a, b) => a.start.localeCompare(b.start)) // Сортуємо слоти за часом
        };
      }

      return {
        ...day,
        isWorking: false,
        slots: []
      };
    });
  }
}
