import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response';
import {
  CreateUserCategoryApplicationDto,
  ReviewUserCategoryApplicationDto,
  UserCategoryApplicationResponseDto,
} from '../models/user-category-application.model';

@Injectable({
  providedIn: 'root',
})
export class UserCategoryApplicationService {
  private baseUrl = `${environment.apiBaseUrl}/usercategoryapplications`;
  private http = inject(HttpClient);

  submit(
    data: CreateUserCategoryApplicationDto,
  ): Observable<ApiResponse<UserCategoryApplicationResponseDto>> {
    const formData = new FormData();
    formData.append('requestedCategory', String(data.requestedCategory));
    formData.append('comment', data.comment ?? '');
    (data.documents || []).forEach((file) => {
      formData.append('documents', file, file.name);
    });

    return this.http.post<ApiResponse<UserCategoryApplicationResponseDto>>(
      this.baseUrl,
      formData,
    );
  }

  getMyApplication(): Observable<
    ApiResponse<UserCategoryApplicationResponseDto | null>
  > {
    return this.http.get<ApiResponse<UserCategoryApplicationResponseDto | null>>(
      `${this.baseUrl}/my`,
    );
  }

  getAll(): Observable<ApiResponse<UserCategoryApplicationResponseDto[]>> {
    return this.http.get<ApiResponse<UserCategoryApplicationResponseDto[]>>(
      this.baseUrl,
    );
  }

  review(
    id: string,
    dto: ReviewUserCategoryApplicationDto,
  ): Observable<ApiResponse<UserCategoryApplicationResponseDto>> {
    return this.http.post<ApiResponse<UserCategoryApplicationResponseDto>>(
      `${this.baseUrl}/${id}/review`,
      dto,
    );
  }
}
