import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AiChatRequest, AiMessage } from '../models/ai-chat-request';
import { ApiResponse } from '../models/api-response';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { PsychologistApplicationResponseDto } from '../models/psychologist-application.model';
import { UserProfileDto } from '../models/user';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private baseUrl = `${environment.apiBaseUrl}/users`;
  private accountUrl = `${environment.apiBaseUrl}/account`;

  private http = inject(HttpClient);

  getUser(id: string): Observable<ApiResponse<UserProfileDto>>{
    return this.http.get<ApiResponse<UserProfileDto>>(`${this.baseUrl}/get-user/${id}`)
  }

  getMyCardNumber(): Observable<ApiResponse<string>> {
    return this.http.get<ApiResponse<string>>(`${this.accountUrl}/card-number`);
  }

  updateMyCardNumber(cardNumber: string): Observable<ApiResponse<string>> {
    return this.http.put<ApiResponse<string>>(`${this.accountUrl}/card-number`, { cardNumber });
  }
}
