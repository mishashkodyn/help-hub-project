import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CreateUpdateSpecializationDto, Specialization, SpecializationAdminDto, SpecializationDto } from '../models/specialization.model';
import { ApiResponse } from '../models/api-response';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SpecializationService {
  private baseUrl = `${environment.apiBaseUrl}/specializations`;

  constructor(private http: HttpClient) {}
  
  getSpecializations(): Observable<ApiResponse<SpecializationDto[]>> {
    return this.http.get<ApiResponse<SpecializationDto[]>>(this.baseUrl);
  }
  
  getSpecializationsForAdmin(): Observable<ApiResponse<SpecializationAdminDto[]>> {
    return this.http.get<ApiResponse<SpecializationAdminDto[]>>(`${this.baseUrl}/admin`);
  }

  createSpecialization(data: CreateUpdateSpecializationDto): Observable<ApiResponse<Specialization>> {
    return this.http.post<ApiResponse<Specialization>>(this.baseUrl, data);
  }

  updateSpecialization(id: string, data: CreateUpdateSpecializationDto): Observable<ApiResponse<Specialization>> {
    return this.http.put<ApiResponse<Specialization>>(`${this.baseUrl}/${id}`, data);
  }

  deleteSpecialization(id: string): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(`${this.baseUrl}/${id}`);
  }
}
