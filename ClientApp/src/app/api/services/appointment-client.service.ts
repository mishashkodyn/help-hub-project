import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ClientSessionDto,
  PastSessionDto,
  SaveAiMessageDto,
  SessionAiMessageDto,
  SessionInfoDto,
  SessionMessageDto,
  SessionNoteDto,
  SessionTranscriptDto,
} from '../models/session.model';

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

  getSessionMessages(id: string): Observable<SessionMessageDto[]> {
    return this.http.get<SessionMessageDto[]>(`${this.apiUrl}/${id}/messages`);
  }

  getSessionTranscripts(id: string): Observable<SessionTranscriptDto[]> {
    return this.http.get<SessionTranscriptDto[]>(`${this.apiUrl}/${id}/transcripts`);
  }

  getSessionAiMessages(id: string): Observable<SessionAiMessageDto[]> {
    return this.http.get<SessionAiMessageDto[]>(`${this.apiUrl}/${id}/ai-messages`);
  }

  saveSessionAiMessages(id: string, messages: SaveAiMessageDto[]): Observable<SessionAiMessageDto[]> {
    return this.http.post<SessionAiMessageDto[]>(`${this.apiUrl}/${id}/ai-messages`, { messages });
  }
}
