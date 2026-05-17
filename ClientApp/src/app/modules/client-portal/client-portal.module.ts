import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { PsychologistListComponent } from './pages/psychologist-list/psychologist-list.component';
import { ClientSessionsComponent } from './pages/client-sessions/client-sessions.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [
    PsychologistListComponent,
    ClientSessionsComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
    SharedModule,
  ],
})
export class ClientPortalModule {}
