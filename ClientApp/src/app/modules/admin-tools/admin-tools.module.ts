import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
import { MatIconModule } from '@angular/material/icon';
import { ApplicationsPageComponent } from './pages/applications-page/applications-page.component';
import { ApplicationDetailsDialogComponent } from './components/application-details-dialog/application-details-dialog.component';
import { MatDialogActions, MatDialogContent } from '@angular/material/dialog';
import { ManageSpecializationsComponent } from './pages/manage-specializations/manage-specializations.component';
import { RouterModule } from '@angular/router';
import { SpecializationDialogComponent } from './components/specialization-dialog/specialization-dialog.component';
import { ReactiveFormsModule } from '@angular/forms';
import { UsersPageComponent } from './pages/users-page/users-page.component';
import { SharedModule } from '../shared/shared.module';



@NgModule({
  declarations: [
    AdminDashboardComponent,
    ApplicationsPageComponent,
    ApplicationDetailsDialogComponent,
    ManageSpecializationsComponent,
    SpecializationDialogComponent,
    UsersPageComponent
  ],
  imports: [
    CommonModule,
    MatToolbarModule,
    MatIconModule,
    MatDialogActions,
    MatDialogContent,
    RouterModule,
    ReactiveFormsModule,
    SharedModule
  ]
})
export class AdminToolsModule { }
