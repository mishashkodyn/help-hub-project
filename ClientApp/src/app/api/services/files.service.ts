import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class FilesService {
  private baseUrl = `${environment.apiBaseUrl}/files`;
  http = inject(HttpClient);

  uploadFiles(files: any[]): Observable<any[]> {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('files', file);
    });

    return this.http.post<any[]>(`${this.baseUrl}/upload`, formData);
  }
}
