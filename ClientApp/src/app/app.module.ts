import { APP_INITIALIZER, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppComponent } from './app.component';
import { ChatModule } from './modules/chat/chat.module';
import { CoreModule } from './modules/core/core.module';
import { SharedModule } from './modules/shared/shared.module';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app.routing.module';
import { AiModule } from './modules/ai/ai.module';
import { MarkdownModule } from 'ngx-markdown';
import { JwtInterceptor } from './api/interceptors/jwt-interceptor';
import { AdminToolsModule } from './modules/admin-tools/admin-tools.module';
import { AuthService } from './api/services/auth.service';
import { catchError, of } from 'rxjs';
import { PsychologistToolsModule } from './modules/psychologist-tools/psychologist-tools.module';
import { ClientPortalModule } from './modules/client-portal/client-portal.module';

export function initializeApp(authService: AuthService) {
  return () => {
    if (!authService.isLoggedIn()) {
      return of(null);
    }

    return authService.me().pipe(
      catchError(() => {
        return of(null);
      }),
    );
  };
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    CommonModule,
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    ChatModule,
    CoreModule,
    AdminToolsModule,
    AiModule,
    SharedModule,
    PsychologistToolsModule,
    ClientPortalModule,
    MarkdownModule.forRoot(),
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: JwtInterceptor,
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [AuthService],
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
