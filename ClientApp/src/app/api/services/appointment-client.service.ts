import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ClientSessionDto, PastSessionDto, SessionInfoDto, SessionNoteDto } from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class AppointmentClientService {
  private apiUrl = `${environment.apiBaseUrl}/appointments`;

  constructor(private http: HttpClient) {}

  getMySessions(): Observable<ClientSessionDto[]> {
    return this.http.get<ClientSessionDto[]>(`${this.apiUrl}/my-sessions`);
  }

  getPsychologistSessions(): Observable<ClientSessionDto[]> {
    return this.http.get<ClientSessionDto[]>(`${this.apiUrl}/psychologist-sessions`);
  }

  getSessionInfo(id: string): Observable<SessionInfoDto> {
    return this.http.get<SessionInfoDto>(`${this.apiUrl}/${id}/info`);
  }

  getPsychologistPastSessions(): Observable<PastSessionDto[]> {
    return this.http.get<PastSessionDto[]>(`${this.apiUrl}/psychologist-past-sessions`);
  }

  getSessionNote(id: string): Observable<SessionNoteDto | null> {
    return this.http.get<SessionNoteDto | null>(`${this.apiUrl}/${id}/note`);
  }

  saveSessionNote(id: string, content: string): Observable<SessionNoteDto> {
    return this.http.put<SessionNoteDto>(`${this.apiUrl}/${id}/note`, { content });
  }

  getTranscriptionToken(id: string): Observable<{ token: string }> {
    return this.http.get<{ token: string }>(`${this.apiUrl}/${id}/transcription-token`);
  }
}
