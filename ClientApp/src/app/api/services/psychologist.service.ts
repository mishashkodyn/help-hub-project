import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  AppointmentApplicationDto,
  CreateAppointmentDto,
  DayScheduleDto,
  PsychologistCatalogFilter,
  PsychologistCatalogPageDto,
  PsychologistResumeDto,
  UpdatePsychologistResumeDto,
} from '../models/psychologist.model';
import { Observable } from 'rxjs';

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

  getAvailableSlots(psychologistId: string, date: string): Observable<string[]> {
    let params = new HttpParams()
      .set('psychologistId', psychologistId)
      .set('date', date);

    return this.http.get<string[]>(`${this.apiUrl}/available-slots`, { params });
  }

  createAppointment(payload: CreateAppointmentDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/book`, payload);
  }

  getPsychologistApplications(): Observable<AppointmentApplicationDto[]> {
    return this.http.get<AppointmentApplicationDto[]>(`${this.apiUrl}/psychologist-applications`);
  }

  approveAppointment(id: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/approve`, {});
  }

  declineAppointment(id: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/decline`, {});
  }

  getMyResume(): Observable<PsychologistResumeDto> {
    return this.http.get<PsychologistResumeDto>(`${this.apiUrl}/resume`);
  }

  updateMyResume(payload: UpdatePsychologistResumeDto): Observable<PsychologistResumeDto> {
    return this.http.put<PsychologistResumeDto>(`${this.apiUrl}/resume`, payload);
  }

  getCatalog(filter: PsychologistCatalogFilter): Observable<PsychologistCatalogPageDto> {
    let params = new HttpParams();

    if (filter.search) params = params.set('search', filter.search);
    if (filter.minPrice != null) params = params.set('minPrice', filter.minPrice);
    if (filter.maxPrice != null) params = params.set('maxPrice', filter.maxPrice);
    if (filter.minExperience != null) params = params.set('minExperience', filter.minExperience);
    if (filter.worksWithMilitary) params = params.set('worksWithMilitary', true);
    if (filter.hasTraumaTraining) params = params.set('hasTraumaTraining', true);
    if (filter.offersFreeSessionsForMilitary) params = params.set('offersFreeSessionsForMilitary', true);
    if (filter.sort) params = params.set('sort', filter.sort);
    if (filter.page) params = params.set('page', filter.page);
    if (filter.pageSize) params = params.set('pageSize', filter.pageSize);

    if (filter.specializationIds?.length) {
      for (const id of filter.specializationIds) {
        params = params.append('specializationIds', id);
      }
    }

    return this.http.get<PsychologistCatalogPageDto>(`${this.apiUrl}/catalog`, { params });
  }
}
