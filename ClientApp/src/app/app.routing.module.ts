import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ChatComponent } from './modules/chat/pages/chat/chat.component';
import { LoginComponent } from './modules/core/pages/login/login.component';
import { RegisterComponent } from './modules/core/pages/register/register.component';

import { AuthGuard } from './guards/auth.guard';
import { loginGuard } from './guards/login.guard';
import { LayoutComponent } from './modules/core/layouts/layout/layout.component';
import { HomePageComponent } from './modules/core/pages/home-page/home-page.component';
import { UsersPageComponent } from './modules/admin-tools/pages/users-page/users-page.component';
import { UserAccountPageComponent } from './modules/core/pages/user-account-page/user-account-page.component';
import { SettingsPageComponent } from './modules/core/pages/settings-page/settings-page.component';
import { EditAccountPageComponent } from './modules/core/pages/edit-account-page/edit-account-page.component';
import { AiChatComponent } from './modules/ai/pages/ai-chat/ai-chat.component';
import { AdminDashboardComponent } from './modules/admin-tools/pages/admin-dashboard/admin-dashboard.component';
import { PsychologistRegistrationComponent } from './modules/core/pages/psychologist-registration/psychologist-registration.component';
import { ApplicationSuccessComponent } from './modules/core/pages/application-success/application-success.component';
import { ApplicationsPageComponent } from './modules/admin-tools/pages/applications-page/applications-page.component';
import { PsychologistListComponent } from './modules/client-portal/pages/psychologist-list/psychologist-list.component';
import { PsychologistDashboardComponent } from './modules/psychologist-tools/pages/psychologist-dashboard/psychologist-dashboard.component';
import { HomePageResolverComponent } from './modules/core/components/home-page-resolver/home-page-resolver.component';
import { NotificationsPageComponent } from './modules/core/pages/notifications-page/notifications-page.component';
import { ManageSpecializationsComponent } from './modules/admin-tools/pages/manage-specializations/manage-specializations.component';

const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: 'chat', canActivate: [AuthGuard], component: ChatComponent },
      { path: 'home', component: HomePageComponent, canActivate: [loginGuard] },
      { path: 'admin/users', canActivate: [AuthGuard], component: UsersPageComponent },
      { path: 'account/:id', canActivate: [AuthGuard], component: UserAccountPageComponent },
      { path: 'settings', canActivate: [AuthGuard], component: SettingsPageComponent },
      { path: 'admin', canActivate: [AuthGuard], component: AdminDashboardComponent },
      { path: 'edit-account', canActivate: [AuthGuard], component: EditAccountPageComponent },
      { path: 'ai-chat', canActivate: [AuthGuard], component: AiChatComponent},
      { path: 'admin/applications', canActivate: [AuthGuard], component: ApplicationsPageComponent },
      { path: 'admin/specializations', canActivate: [AuthGuard], component: ManageSpecializationsComponent},
      { path: '', component: HomePageResolverComponent},
      {
        path: 'register',
        component: RegisterComponent,
        canActivate: [loginGuard],
      },
      {
        path: 'login',
        component: LoginComponent,
        canActivate: [loginGuard],
      },
      {
        path: 'psychologist-registration',
        component: PsychologistRegistrationComponent,
        canActivate: [AuthGuard],
      },
      {
        path: 'application-success',
        component: ApplicationSuccessComponent,
        canActivate: [AuthGuard],
      },
      {
        path: 'catalog',
        component: PsychologistListComponent,
        canActivate: [AuthGuard],
      },
      {
        path: 'psychologist-dashboard',
        component: PsychologistDashboardComponent,
        canActivate: [AuthGuard],
      },
      {
        path: 'notifications',
        component: NotificationsPageComponent,
        canActivate: [AuthGuard],
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
