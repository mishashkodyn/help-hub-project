import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PsychologistDashboardComponent } from './pages/psychologist-dashboard/psychologist-dashboard.component';
import { MatIconModule } from '@angular/material/icon';



@NgModule({
  declarations: [
    PsychologistDashboardComponent
  ],
  imports: [
    CommonModule,
    MatIconModule
  ]
})
export class PsychologistToolsModule { }
