import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PsychologistListComponent } from './pages/psychologist-list/psychologist-list.component';
import { MatIconModule } from '@angular/material/icon';



@NgModule({
  declarations: [
    PsychologistListComponent
  ],
  imports: [
    CommonModule,
    MatIconModule
  ]
})
export class ClientPortalModule { }
