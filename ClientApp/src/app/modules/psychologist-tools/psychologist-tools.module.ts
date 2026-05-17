import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PsychologistDashboardComponent } from './pages/psychologist-dashboard/psychologist-dashboard.component';
import { MatIconModule } from '@angular/material/icon';
import { PsychologistCalendarPageComponent } from './pages/psychologist-calendar-page/psychologist-calendar-page.component';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../shared/shared.module';
import { PsychologistApplicationsComponent } from './pages/psychologist-applications/psychologist-applications.component';
import { PsychologistSessionsComponent } from './pages/psychologist-sessions/psychologist-sessions.component';
import { PsychologistPastSessionsComponent } from './pages/psychologist-past-sessions/psychologist-past-sessions.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PsychologistProfileEditorComponent } from './pages/psychologist-profile-editor/psychologist-profile-editor.component';
import { ReactiveFormsModule } from '@angular/forms';



@NgModule({
  declarations: [
    PsychologistDashboardComponent,
    PsychologistCalendarPageComponent,
    PsychologistApplicationsComponent,
    PsychologistSessionsComponent,
    PsychologistPastSessionsComponent,
    PsychologistProfileEditorComponent
  ],
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    SharedModule
  ]
})
export class PsychologistToolsModule { }
