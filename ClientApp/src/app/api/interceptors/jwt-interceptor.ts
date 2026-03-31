import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  catchError,
  filter,
  Observable,
  switchMap,
  take,
  throwError,
} from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ApiResponse } from '../models/api-response';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  private isRefreshing = false;

  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(
    null,
  );

  constructor(
    public authService: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  intercept(
    request: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {
    console.log(1);
    if (
      request.url.includes('/login') ||
      request.url.includes('/register') ||
      request.url.includes('/refresh')
    ) {
      return next.handle(request);
    }

    if (this.authService.getAccessToken) {
      request = this.addTokenHeader(request, this.authService.getAccessToken);
    }

    return next.handle(request).pipe(
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return this.handleAuthError(request, next);
        }
        return throwError(() => error);
      }),
    );
  }

  private addTokenHeader(request: HttpRequest<any>, token: string) {
    return request.clone({
      headers: request.headers.set('Authorization', `Bearer ${token}`),
    });
  }

  private handleAuthError(request: HttpRequest<any>, next: HttpHandler) {
      console.log(3);
    
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);
      console.log(4);
      return this.authService.refreshToken().pipe(
        switchMap((tokenResponse: ApiResponse<string>) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(tokenResponse.data);
          return next.handle(this.addTokenHeader(request, tokenResponse.data));
        }),
        catchError((err) => {
          this.isRefreshing = false;
          this.authService.logout();
          return throwError(() => err);
        }),
      );
    } else {
      return this.refreshTokenSubject.pipe(
        filter((token) => token !== null),
        take(1),
        switchMap((token) => {
          return next.handle(this.addTokenHeader(request, token));
        }),
      );
    }
  }
}
