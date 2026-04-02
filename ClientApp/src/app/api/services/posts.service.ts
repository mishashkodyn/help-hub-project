import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import {
  CommentResponseDto,
  CreateCommentDto,
  CreatePostDto,
  PostResponseDto,
} from '../models/post.model';
import { ApiResponse } from '../models/api-response';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PostsService {
  private baseUrl = `${environment.apiBaseUrl}/posts`;

  constructor(private http: HttpClient) {}

  getPosts(
    page: number = 1,
    pageSize: number = 10,
    userId?: string,
  ): Observable<ApiResponse<PostResponseDto[]>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (userId) {
      params = params.set('userId', userId);
    }

    return this.http.get<ApiResponse<PostResponseDto[]>>(this.baseUrl, {
      params,
    });
  }

  createPost(data: CreatePostDto): Observable<ApiResponse<PostResponseDto>> {
    const formData = new FormData();

    formData.append('Content', data.content);

    if (data.mediaFiles && data.mediaFiles.length > 0) {
      data.mediaFiles.forEach((file) => {
        formData.append('MediaFiles', file, file.name);
      });
    }

    return this.http.post<ApiResponse<PostResponseDto>>(this.baseUrl, formData);
  }

  toggleLike(postId: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${this.baseUrl}/${postId}/toggle-like`,
      {},
    );
  }

  getComments(
    postId: string,
    page: number = 1,
    pageSize: number = 10,
  ): Observable<ApiResponse<CommentResponseDto[]>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    return this.http.get<ApiResponse<CommentResponseDto[]>>(
      `${this.baseUrl}/${postId}/comments`,
      { params },
    );
  }

  createComment(
    postId: string,
    data: CreateCommentDto,
  ): Observable<ApiResponse<CommentResponseDto>> {
    return this.http.post<ApiResponse<CommentResponseDto>>(
      `${this.baseUrl}/${postId}/comments`,
      data,
    );
  }
}
