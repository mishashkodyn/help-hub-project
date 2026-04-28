import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PsychologistDashboardComponent } from './pages/psychologist-dashboard/psychologist-dashboard.component';
import { MatIconModule } from '@angular/material/icon';
import { PsychologistCalendarPageComponent } from './pages/psychologist-calendar-page/psychologist-calendar-page.component';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../shared/shared.module';



@NgModule({
  declarations: [
    PsychologistDashboardComponent,
    PsychologistCalendarPageComponent
  ],
  imports: [
    CommonModule,
    MatIconModule,
    RouterLink,
    FormsModule,
    SharedModule
  ]
})
export class PsychologistToolsModule { }
