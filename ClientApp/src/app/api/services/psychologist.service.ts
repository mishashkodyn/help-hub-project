import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { DayScheduleDto } from '../models/psychologist.model';

@Injectable({
  providedIn: 'root'
})
export class PsychologistService {
  private apiUrl = `${environment.apiBaseUrl}/psychologists`;
  
  constructor(private http: HttpClient) { }

  getSchedule() {
    return this.http.get<{ schedule: DayScheduleDto[] }>(this.apiUrl + '/schedule');
  }

  saveSchedule(schedule: DayScheduleDto[]) {
    return this.http.put(this.apiUrl + '/schedule', { schedule });
  }
}
