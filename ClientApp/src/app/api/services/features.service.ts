import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AppFeatures {
  cameraWall: boolean;
}

const DEFAULT_FEATURES: AppFeatures = { cameraWall: false };

@Injectable({ providedIn: 'root' })
export class FeaturesService {
  private features$: Observable<AppFeatures>;

  constructor(private http: HttpClient) {
    this.features$ = this.http
      .get<AppFeatures>(`${environment.apiBaseUrl}/config/features`)
      .pipe(
        catchError(() => of(DEFAULT_FEATURES)),
        shareReplay(1)
      );
  }

  getFeatures(): Observable<AppFeatures> {
    return this.features$;
  }
}
