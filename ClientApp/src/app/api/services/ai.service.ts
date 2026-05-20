import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AiChatRequest, AiMessage } from '../models/ai-chat-request';
import { ApiResponse } from '../models/api-response';
import { TranscriptAnalysisRequest } from '../models/transcript-analysis-request';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class AiService {
  private baseUrl = `${environment.apiBaseUrl}/ai`;

  private http = inject(HttpClient);

  chatAsync(request: AiChatRequest): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(
      `${this.baseUrl}/chat`,
      request,
    );
  }

  analyzeTranscriptAsync(request: TranscriptAnalysisRequest): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(
      `${this.baseUrl}/analyze-transcript`,
      request,
    );
  }
}
